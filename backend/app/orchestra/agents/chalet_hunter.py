import re
from langgraph.prebuilt import create_react_agent

def sanitize_llm_output(text: str) -> str:
    """Brute-force strips markdown links and JSON brackets to prevent tool-call crashes."""
    if not text:
        return "No data found."
    # Convert markdown links [Name](url) to plain text "Name: url"
    text = re.sub(r'\[(.*?)\]\((.*?)\)', r'\1: \2', text)
    # Strip JSON/Dictionary brackets
    text = text.replace('{', '').replace('}', '').replace('[', '').replace(']', '')
    return text

def chalet_hunter_node(state: dict, llm, tools) -> dict:
    target_resort = state["target_resort"]
    guests = state.get("criteria", {}).get("number_of_guests", 2)
    price = state.get("criteria", {}).get("max_budget_per_night", 300)
    personality = state.get("user_personality", "")
    
    print(f"\n⛷️ [HUNTER] DEEP WEB HUNT IN {target_resort.upper()}...")

    agent = create_react_agent(llm, tools=tools)
    
    persona_instruction = ""
    if personality:
        persona_instruction = f"\nCRITICAL: User vibe: '{personality}'. Prioritize finding chalets that fit this vibe.\n"

    prompt = (
        f"You are an elite, budget-conscious ski travel hacker. Your mission is to find affordable, authentic ski accommodations in {target_resort} for {guests} guests.\n\n"
        f"CRITICAL VIBE CHECK: We DO NOT want luxury. Reject anything labeled 'luxury', 'exclusive', 'premium', or '5-star'. "
        f"We want rustic, charming, mom-and-pop hidden gems that cost strictly under or around €{price} per night.\n\n"
        f"DEEP SEARCH TACTICS:\n"
        f"1. USE LOCAL LANGUAGE: 'Chalet' often means expensive luxury. You MUST translate 'guesthouse', or 'apartment' into the native language of {target_resort} (e.g., 'Gîte' for France, 'casa vacanza' or 'alloggio di gruppo' for Italy, 'Ferienhaus' or 'Gasthaus' for Austria).\n"        f"2. BAN AGGREGATORS: We DO NOT want generic booking.com, airbnb, vrbo, or tripadvisor region pages. We want DIRECT websites of the accommodations.\n"
        f"2. BAN AGGREGATORS FIRST: Only allow DIRECT property websites. Possibly use negative keywords like '-site:booking.com -site:airbnb.com' in your initial searches.\n"
        f"3. DIG DEEPER: Do not stop after one search. You MUST run at least 8 - 12 different web_search queries using different local keywords AND different villages inside that region before you finalize your list.\n"
        f"4. VERIFY WITH SCRAPER: Use scrape_website on the URLs. If the page is an aggregator listing multiple accommodations, IGNORE IT. This is very important. Only record specific, single properties.\n\n"
        f"CRITICAL: DO NOT give up and DO NOT return an empty list. Even if the results aren't perfect, give me the best budget options you found.\n\n"
        f"Gather a massive list of these specific, budget-friendly properties. Don't filter them out, just list them.\n\n"
        f"CRITICAL FINAL STEP: Output your final list as PLAIN TEXT ONLY. "
        f"Write it as: 'Name - Village - Price - Distance - URL - ImageURL'. DO NOT use JSON. DO NOT leave blank."
    )

    try:
        response = agent.invoke({"messages": [("user", prompt)]}, {"recursion_limit": 25})
        raw_content = response["messages"][-1].content
        safe_content = sanitize_llm_output(raw_content)
        return {"raw_chalets": safe_content}
        
    except Exception as e:
        print(f"⚠️ [HUNTER ALARM] Agent crashed: {e}")
        return {"raw_chalets": f"Hunter encountered an error. Resort: {target_resort}."}