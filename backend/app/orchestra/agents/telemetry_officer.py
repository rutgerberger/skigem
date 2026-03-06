import os
import re
import requests
from langchain_groq import ChatGroq
from app.models.schemas import ResortTelemetry
from app.orchestra.tools.search_api import search_tool  # Your existing search tool
from bs4 import BeautifulSoup
import re
from app.models.schemas import ResortProfileSchema

def generate_resort_profile(resort_name: str) -> dict:
    print(f"🕵️ [Intel Officer] Drafting comprehensive target briefing for: {resort_name}")

    try:
        clean_name = resort_name.split('-')[0].strip()
        search_query = f"{clean_name} ski resort official website overview villages slopes atmosphere"
        search_results = search_tool.invoke({"query": search_query})
        
        raw_context = f"Resort: {clean_name}\nSearch Intel:\n{search_results}"

        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.2, # Slight creativity allowed for writing a nice description
            api_key=os.environ.get("GROQ_API_KEY")
        )
        
        structured_llm = llm.with_structured_output(ResortProfileSchema)
        
        prompt = f"""
        You are a veteran ski journalist writing a briefing for a tactical ski dashboard.
        Based on your vast internal knowledge AND the provided search context, write a 3-part profile for the ski resort.
        Please do not provide general descriptions (e.g. "This is a vibrant ski resort") but focus on what stands out for this exact resort.
        
        CRITICAL RULES:
        1. USE THE PROVIDED TOOL to output the JSON schema. No conversational text.
        2. 'overview': Describe the main area, key highlights, and specific villages included. (approx 3 sentences).
        3. 'slopes': Describe the terrain type, sun exposure (e.g., South-facing?), snow reliability/altitude and how suited it is for off-piste. Also show which parts of the resort are suited for which level of skiers (beginner - advanced) (approx 5 sentences).
        4. 'atmosphere': Describe the vibe. Is it luxury? Family-friendly? Hardcore freeride? Party central? (approx 3 sentences).
        5. 'official_url': Extract the exact official website URL from the search context, or use your internal knowledge.
        
        Context:
        {raw_context}
        """
        
        result = structured_llm.invoke(prompt)
        print(f"✅ [Intel Officer] Target briefing compiled.")
        return result.model_dump()

    except Exception as e:
        print(f"🚨 [Intel Officer] Profile generation failed: {e}")
        return None
    
def fetch_official_skimap(resort_name: str) -> str | None:
    """
    1. Search Skimap.org HTML to find the Resort ID.
    2. Visit the Resort's HTML page.
    3. Scrape the primary image URL from the most recent map figure.
    """
    try:
        # Clean the name (remove parentheses and handle dashes)
        clean_name = re.sub(r'\(.*?\)', '', resort_name).split('-')[0].strip()
        print(f"🗺️ [Skimap] Initializing HTML deep-scrape for: {clean_name}")

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        }

        # --- STEP 1: SEARCH ---
        search_url = f"https://skimap.org/search/results?sort=map_count&query={clean_name}"
        search_resp = requests.get(search_url, headers=headers, timeout=10)
        
        if not search_resp.ok:
            return None

        search_soup = BeautifulSoup(search_resp.text, 'html.parser')
        # Find the first result link
        area_link = search_soup.find('a', href=re.compile(r'/skiareas/view/\d+'))
        
        if not area_link:
            print("⚠️ [Skimap] No resort found in search results.")
            return None

        resort_url = f"https://skimap.org{area_link['href']}"
        print(f"🔗 [Skimap] Target found: {resort_url}")

        # --- STEP 2: SCRAPE RESORT PAGE ---
        resort_resp = requests.get(resort_url, headers=headers, timeout=10)
        if not resort_resp.ok:
            return None

        resort_soup = BeautifulSoup(resort_resp.text, 'html.parser')

        # We look for the first <figure> tag. Skimap lists them newest-to-oldest.
        # The first figure with class 'figure' usually contains the newest map.
        first_figure = resort_soup.find('figure', class_='figure')
        
        if not first_figure:
            print("⚠️ [Skimap] No map figures found on the resort page.")
            return None

        # Look for the <img> tag inside the figure
        img_tag = first_figure.find('img')
        
        if img_tag and img_tag.get('src'):
            map_url = img_tag['src']
            
            # Skimap often uses a 'files.skimap.org' subdomain. 
            # If the URL is relative, prepend the protocol.
            if map_url.startswith('//'):
                map_url = f"https:{map_url}"
            
            print(f"✅ [Skimap] Success! Acquired map URL: {map_url}")
            return map_url

        print("⚠️ [Skimap] Image tag found, but 'src' attribute is missing.")
        return None

    except Exception as e:
        print(f"❌ [Skimap] Scraping pipeline failed: {e}")
        return None
def gather_resort_telemetry(resort_name: str) -> dict:
    print(f"🛰️ [Telemetry Officer] Initializing scan for: {resort_name}")

    try:
        search_query = f"{resort_name} current snow report weather open lifts historical snowfall"
        search_results = search_tool.invoke({"query": search_query})
        
        extracted_urls = re.findall(r"URL: (http[s]?://[^\s]+)", search_results)
        unique_urls = list(dict.fromkeys(extracted_urls))
        raw_context = f"Resort: {resort_name}\nSearch Intel:\n{search_results}"

        llm = ChatGroq(
            model="llama-3.3-70b-versatile", # <-- UPGRADED FOR STRICT TOOL CALLING
            temperature=0.0, 
            api_key=os.environ.get("GROQ_API_KEY")
        )
        
        structured_llm = llm.with_structured_output(ResortTelemetry)

        prompt = f"""
        You are the Telemetry Officer for a high-tech ski scouting application.
        Extract the live weather, snow conditions, and lift status.
        
        CRITICAL RULES:
        1. USE THE PROVIDED TOOL: You must invoke the extraction tool to format your response. 
        2. NO PREAMBLE: Do not write any conversational text, explanations, or step-by-step logic.
        3. FALLBACKS: If exact numbers are missing, intelligently infer them or use 0.
        
        Context:
        {raw_context}
        """

        print(f"🧠 [Telemetry Officer] Parsing data streams...")
        result = structured_llm.invoke(prompt)
        
        output_dict = result.model_dump()
        output_dict["source_urls"] = unique_urls
        
        print(f"✅ [Telemetry Officer] Data extracted successfully.")
        return output_dict

    except Exception as e:
        print(f"🚨 [Telemetry Officer] SYSTEM FAILURE on {resort_name}: {e}")
        # FOOLPROOF FALLBACK: Returns empty data instead of crashing the server
        return {
            "resort_name": resort_name,
            "weather": {"condition": "NO DATA / AI OFFLINE", "temp_base_c": 0, "temp_peak_c": 0, "wind_speed_kmh": 0},
            "snow": {"base_depth_cm": 0, "peak_depth_cm": 0, "forecast_next_48h_cm": 0, "historical_4_weeks": []},
            "open_lifts": 0,
            "total_lifts": 0,
            "crowd_expectation": "UNKNOWN",
            "source_urls": [],
            "last_updated": None,
            "official_ski_map_url": None
        }