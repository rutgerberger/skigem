import time
import difflib
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import PydanticOutputParser
from app.models.schemas import Phase1Result
from app.database import SessionLocal
from app.models.domain import Resort

def resort_scout_node(state: dict, llm, tools) -> dict:
    print("\n⛷️ Phase A: Resort Scout is compiling the briefing...")
    criteria = state["criteria"]
    country = criteria.get('country') or "Austria"
    if country == "null": country = "Austria"
    
    # 1. Gather Radar Preferences
    prefs_string = (
        f"- Pistes: {criteria.get('pref_pisteKms', 3)}/5\n"
        f"- Après-Ski: {criteria.get('pref_apres', 3)}/5\n"
        f"- Off-Piste: {criteria.get('pref_offPiste', 3)}/5\n"
        f"- Snow Reliability: {criteria.get('pref_snow', 3)}/5\n"
        f"- Family: {criteria.get('pref_family', 3)}/5\n"
        f"- Quiet: {criteria.get('pref_quiet', 3)}/5"
    )
    
    # 2. Pre-fetch Context using the Search Tool
    web_context = ""
    if tools and len(tools) > 0:
        try:
            print("🔍 Executing background web reconnaissance...")
            search_tool = tools[0] # Assuming Tavily/Web Search is the first tool
            query = f"Best ski resorts in {country} known for {criteria.get('additional_requirements', 'good snow and vibes')}"
            
            # Use the tool to pull live internet data
            search_result = search_tool.invoke({"query": query})
            web_context = f"--- LIVE WEB CONTEXT ---\n{search_result}\n----------------------\n\n"
        except Exception as e:
            print(f"⚠️ Background search skipped: {e}")

    # 3. Load Valid Resorts from DB
    db = SessionLocal()
    try:
        # Prioritize matching country, fallback to all if empty
        db_resorts = db.query(Resort).filter(Resort.country.ilike(f"%{country}%")).all()
        if not db_resorts:
            db_resorts = db.query(Resort).all()
            
        allowed_names = [r.name for r in db_resorts]
        allowed_list_str = "\n- ".join(allowed_names)
    finally:
        db.close()

    # 4. LLM Generation Setup (Using Pydantic Parser)
    parser = PydanticOutputParser(pydantic_object=Phase1Result)
    
    system_prompt = (
        "You are a master ski resort curator and data extractor. "
        "You must respond strictly in valid JSON format. "
        "Do NOT attempt to call any external functions."
    )
    
    # RE-ADDED THE DATABASE LIST TO THE PROMPT
    prompt = (
        f"Identify up to 3 ski resorts in {country} that best match the following criteria.\n\n"
        f"User Preferences (1-5 scale):\n{prefs_string}\n\n"
        f"Requirements: {criteria.get('additional_requirements', 'None')}\n\n"
        f"{web_context}"
        f"CRITICAL OVERRIDE: You MUST ONLY select resorts from this exact database list:\n"
        f"{allowed_list_str}\n\n"
        f"Do not invent or suggest any resort not on this exact list. "
        f"Provide altitude_info, slope_length_km, vibe, logistics, and avg_pass_price_eur for each.\n\n"
        f"FORMAT INSTRUCTIONS:\n{parser.get_format_instructions()}"
    )

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=prompt)
            ])
            
            parsed = parser.parse(response.content)
            
            if not parsed or not parsed.resorts:
                continue

            # 5. 3-TIER BULLETPROOF MATCHING LOGIC
            verified_resorts = []
            for resort in parsed.resorts:
                
                # Tier 1: Exact Match
                if resort.name in allowed_names:
                    verified_resorts.append(resort)
                    continue
                
                # Tier 2: Substring Match (e.g. LLM says "Sölden", DB has "Ötztal Valley (Sölden)")
                found_substring = False
                for db_name in allowed_names:
                    if resort.name.lower() in db_name.lower() or db_name.lower() in resort.name.lower():
                        resort.name = db_name # Overwrite with strict DB name
                        verified_resorts.append(resort)
                        found_substring = True
                        break
                if found_substring: continue
                
                # Tier 3: Forgiving Fuzzy Match
                matches = difflib.get_close_matches(resort.name, allowed_names, n=1, cutoff=0.3)
                if matches:
                    resort.name = matches[0]
                    verified_resorts.append(resort)
            
            if verified_resorts:
                # Deduplicate just in case multiple LLM guesses mapped to the same DB string
                unique_resorts = list({r.name: r for r in verified_resorts}.values())
                print(f"🎯 Mapped & Verified Resorts: {[r.name for r in unique_resorts]}")
                parsed.resorts = unique_resorts
                return {"final_resorts": parsed.model_dump()}
            else:
                print(f"⚠️ Attempt {attempt+1}: Could not map generated resorts to database.")

        except Exception as e:
            print(f"❌ Attempt {attempt+1} Error: {e}")
            time.sleep(1)

    print("🚨 All retry attempts exhausted. Returning empty array.")
    return {"final_resorts": {"resorts": []}}