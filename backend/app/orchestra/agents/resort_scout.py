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
    
    # Safely extract preferences (default to 3/5)
    pref_piste = int(criteria.get('pref_pisteKms', 3))
    pref_apres = int(criteria.get('pref_apres', 3))
    pref_offpiste = int(criteria.get('pref_offPiste', 3))
    pref_snow = int(criteria.get('pref_snow', 3))
    pref_family = int(criteria.get('pref_family', 3))
    pref_quiet = int(criteria.get('pref_quiet', 3))
    add_reqs = criteria.get('additional_requirements')
    
    prefs_string = (
        f"- Pistes: {pref_piste}/5\n"
        f"- Après-Ski: {pref_apres}/5\n"
        f"- Off-Piste: {pref_offpiste}/5\n"
        f"- Snow Reliability: {pref_snow}/5\n"
        f"- Family: {pref_family}/5\n"
        f"- Quiet: {pref_quiet}/5"
    )
    
    # --- UPGRADE 1: SMART WEB SEARCH QUERY ---
    search_keywords = []
    if pref_apres >= 4: search_keywords.append("lively après-ski")
    if pref_offpiste >= 4: search_keywords.append("freeride off-piste")
    if pref_snow >= 4: search_keywords.append("snow-sure high altitude")
    if pref_family >= 4: search_keywords.append("family friendly")
    if pref_quiet >= 4: search_keywords.append("quiet uncrowded hidden gems")
    
    # Only append additional requirements if it's not empty or "None"
    has_reqs = add_reqs and str(add_reqs).strip().lower() != "none"
    if has_reqs:
        search_keywords.append(str(add_reqs).strip())
        
    # Combine keywords, or default to general best conditions
    search_focus = ", ".join(search_keywords) if search_keywords else "best overall conditions and runs"
    
    web_context = ""
    if tools and len(tools) > 0:
        try:
            print(f"🔍 Executing background web reconnaissance...")
            search_tool = tools[0] 
            query = f"Best ski resorts in {country} known for {search_focus}"
            print(f"   -> [Search Prompt] {query}")
            
            search_result = search_tool.invoke({"query": query})
            web_context = f"--- LIVE WEB CONTEXT ---\n{search_result}\n----------------------\n\n"
        except Exception as e:
            print(f"⚠️ Background search skipped: {e}")

    # --- UPGRADE 2: LINEAR PISTE KM FILTERING ---
    # Formula maps scale 1-5 to 0, 50, 100, 150, 200km minimums
    min_piste_km = max(0, (pref_piste - 1) * 50)
    print(f"🏔️ Filtering DB for {country} resorts with a minimum of {min_piste_km}km of slopes...")

    db = SessionLocal()
    try:
        # Base query for the target country
        base_query = db.query(Resort).filter(Resort.country.ilike(f"%{country}%"))
        
        # Apply the slope length filter
        db_resorts = base_query.filter(Resort.total_slopes >= min_piste_km).all()
        
        # Fallback 1: If the user demanded >200km but the country doesn't have any, relax the constraint
        if not db_resorts:
            print("⚠️ Strict slope filter yielded 0 targets. Relaxing slope constraints...")
            db_resorts = base_query.all()
            
        # Fallback 2: If the country is totally empty/wrong, grab everything
        if not db_resorts:
            print("⚠️ Target country empty. Expanding to global DB...")
            db_resorts = db.query(Resort).all()
            
        allowed_names = [r.name for r in db_resorts]
        
        # Construct rich context for the LLM
        resort_facts = []
        for r in db_resorts:
            fact = (f"[{r.name}] -> Slopes: {r.total_slopes}km (Beg:{r.beginner_slopes}km, Int:{r.intermediate_slopes}km, Diff:{r.difficult_slopes}km) | "
                    f"Alt: {r.lowest_point}m - {r.highest_point}m | Lifts: {r.total_lifts} | "
                    f"Price: €{r.price} | Parks: {'Yes' if r.snowparks else 'No'} | "
                    f"Child Friendly: {'Yes' if r.child_friendly else 'No'}")
            resort_facts.append(fact)
            
        db_facts_str = "\n".join(resort_facts)

    finally:
        db.close()

    parser = PydanticOutputParser(pydantic_object=Phase1Result)
    
    system_prompt = (
        "You are a master ski resort curator and data extractor. "
        "You must respond strictly in valid JSON format. "
        "Do NOT attempt to call any external functions."
    )
    
    prompt = (
        f"Identify up to 3 ski resorts in {country} that best match the following criteria.\n\n"
        f"User Preferences (1-5 scale):\n{prefs_string}\n\n"
        f"Requirements: {criteria.get('additional_requirements', 'None')}\n\n"
        f"{web_context}"
        f"CRITICAL DIRECTIVE: You MUST ONLY select resorts from the database list below. "
        f"You MUST use the EXACT stats provided in this database list (do not invent slope lengths or prices):\n\n"
        f"--- DATABASE TRUTH --- \n"
        f"{db_facts_str}\n"
        f"---------------------- \n\n"
        f"Provide altitude_info, slope_length_km, vibe, logistics, and avg_pass_price_eur for each selected resort.\n\n"
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

            # 3-TIER BULLETPROOF MATCHING LOGIC
            verified_resorts = []
            for resort in parsed.resorts:
                if resort.name in allowed_names:
                    verified_resorts.append(resort)
                    continue
                
                found_substring = False
                for db_name in allowed_names:
                    if resort.name.lower() in db_name.lower() or db_name.lower() in resort.name.lower():
                        resort.name = db_name 
                        verified_resorts.append(resort)
                        found_substring = True
                        break
                if found_substring: continue
                
                matches = difflib.get_close_matches(resort.name, allowed_names, n=1, cutoff=0.3)
                if matches:
                    resort.name = matches[0]
                    verified_resorts.append(resort)
            
            if verified_resorts:
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