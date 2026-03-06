import os
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List
from langchain_groq import ChatGroq

# Import schemas and your search tool
from app.models.schemas import FilteredNews, ResortBucketList
from app.orchestra.tools.search_api import search_tool 

# ==========================================
# MODULE 1: TACTICAL NEWS (RSS + ID MAPPING)
# ==========================================

def fetch_real_news(resort_name: str) -> list:
    """Fetches real, timestamped news directly from Google News RSS."""
    query = urllib.parse.quote(f"{resort_name} ski resort avalanche OR weather OR open OR news")
    url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    
    articles = []
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            xml_data = response.read()
            root = ET.fromstring(xml_data)
            
            # Grab top 10 articles
            for idx, item in enumerate(root.findall('.//item')[:10]):
                articles.append({
                    "id": idx,
                    "title": item.find('title').text,
                    "link": item.find('link').text,
                    "pub_date": item.find('pubDate').text
                })
    except Exception as e:
        print(f"⚠️ [RSS Error] Failed to fetch ground-truth news for {resort_name}: {e}")
    
    return articles

def gather_resort_news(resort_name: str) -> dict:
    print(f"📡 [Intel Officer] Intercepting raw comms for: {resort_name}")
    
    raw_articles = fetch_real_news(resort_name)
    
    if not raw_articles:
        return {"resort_name": resort_name, "intel_feed": []}

    ai_context = "\n".join([
        f"ID: {a['id']} | Date: {a['pub_date']} | Title: {a['title']}" 
        for a in raw_articles
    ])

    try:
        llm = ChatGroq(
            model="meta-llama/llama-4-scout-17b-16e-instruct", 
            temperature=0.0, # Zero creativity allowed
            api_key=os.environ.get("GROQ_API_KEY")
        )
        
        structured_llm = llm.with_structured_output(FilteredNews)
        
        prompt = f"""
        You are a tactical intelligence officer. Review the following real news articles.
        Select up to 4 of the most relevant articles for a skier visiting this resort (look for snow dumps, avalanches, closures, or major events).
        Return ONLY their exact IDs and a severity rating.
        
        CRITICAL RULES:
        1. DO NOT write any conversational text, preamble, or explanations.
        2. Output ONLY the raw structured data/tool call.
        3. A news article is only relevant if its date is very recent (now: {datetime.now().strftime('%Y-%m-%d')}).

        RELEVANCE CRITERIA:
        - A news article is only relevant if its date is very recent (now: {datetime.now().strftime('%Y-%m-%d')}).
        
        Articles:
        {ai_context}
        """
        
        print(f"🧠 [Intel Officer] Filtering signal from noise...")
        result = structured_llm.invoke(prompt)
        
        final_feed = []
        for selection in result.selections:
            original_article = next((a for a in raw_articles if a["id"] == selection.article_id), None)
            
            if original_article:
                final_feed.append({
                    "headline": original_article["title"],
                    "severity": selection.severity,
                    "url": original_article["link"],
                    "date": original_article["pub_date"]
                })
                
        print(f"✅ [Intel Officer] Validated {len(final_feed)} tactical updates.")
        return {
            "resort_name": resort_name, 
            "intel_feed": final_feed
        }
        
    except Exception as e:
        print(f"🚨 [Intel Officer] LLM Filter failed: {e}")
        # Graceful degradation fallback
        return {"resort_name": resort_name, "intel_feed": []}


# ==========================================
# MODULE 2: BUCKET LIST RECON (SEARCH + STRICT EXTRACTION)
# ==========================================

def generate_ai_bucket_targets(resort_name: str) -> dict:
    print(f"🎯 [Targeting System] Scanning web for high-value targets at: {resort_name}")

    try:
        # Simplify the name for better search results
        clean_name = resort_name.split('-')[0].strip()
        search_query = f"Top 10 best pistes runs hidden gems apres ski restaurants {clean_name} ski resort"
        
        # Invoke the search tool
        search_results = search_tool.invoke(search_query) 
        
        raw_context = f"Resort: {clean_name}\nSearch Intel:\n{search_results}"

        llm = ChatGroq(
            model="llama-3.3-70b-versatile", # <-- FIX 1: Upgraded model for perfect tool calling
            temperature=0.0, 
            api_key=os.environ.get("GROQ_API_KEY")
        )
        
        structured_llm = llm.with_structured_output(ResortBucketList)
        
        # FIX 2: Adjusted Prompt rules to encourage Tool Calling
        prompt = f"""
        You are a veteran local ski guide extracting data from raw search intel.
        Based STRICTLY on the search context provided below, create a 5-item bucket list.
        
        CRITICAL RULES:
        1. USE THE PROVIDED TOOL: You must invoke the extraction tool to format your response. Do not output raw text. Make sure to include both the resort_name and the items list.
        2. NO HALLUCINATIONS: You may only list places, runs, or bars EXACTLY as they are named in the text.
        3. URLs: If the text contains a URL immediately associated with the place, extract it. If not, set url to null.
        4. DESCRIPTION: Write a short, exciting tactical description (1-2 sentences) based ONLY on what the text says.
        5. EMOJI: Assign a fitting single emoji to the 'logo' field based on the category (e.g., 🍻 for APRES, 🏔️ for PISTE).
        
        Context:
        {raw_context}
        """
        
        print(f"🧠 [Targeting System] Extracting verifiable targets from search data...")
        result = structured_llm.invoke(prompt)
        
        print(f"✅ [Targeting System] Secured {len(result.items)} high-value targets.")
        return result.model_dump()

    except Exception as e:
        print(f"🚨 [Targeting System] FAILURE: {e}")
        # Graceful degradation fallback
        return {
            "resort_name": resort_name, 
            "items": []
        }