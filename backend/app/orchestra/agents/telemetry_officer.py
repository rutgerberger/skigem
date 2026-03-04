import os
import re
import requests
from langchain_groq import ChatGroq
from app.models.schemas import ResortTelemetry
from app.orchestra.tools.search_api import search_tool  # Your existing search tool
from bs4 import BeautifulSoup
import re
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
    """
    Scrapes the web ONLY for live weather, snow depth, and lift status.
    (Map fetching is now handled purely at the database level).
    """
    print(f"🛰️ [Telemetry Officer] Initializing scan for: {resort_name}")

    search_query = f"{resort_name} current snow report weather open lifts historical snowfall"
    search_results = search_tool.invoke({"query": search_query})
    
    extracted_urls = re.findall(r"URL: (http[s]?://[^\s]+)", search_results)
    unique_urls = list(dict.fromkeys(extracted_urls))
    raw_context = f"Resort: {resort_name}\nSearch Intel:\n{search_results}"

    llm = ChatGroq(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        temperature=0.1, 
        api_key=os.environ.get("GROQ_API_KEY")
    )
    
    structured_llm = llm.with_structured_output(ResortTelemetry)

    prompt = f"""
    You are the Telemetry Officer for a high-tech ski scouting application.
    Extract the live weather, snow conditions, and lift status...
    Context:
    {raw_context}
    """

    print(f"🧠 [Telemetry Officer] Parsing data streams...")
    result = structured_llm.invoke(prompt)
    
    output_dict = result.model_dump()
    output_dict["source_urls"] = unique_urls
    
    print(f"✅ [Telemetry Officer] Data extracted successfully.")
    return output_dict