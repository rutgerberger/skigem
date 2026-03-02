import os
import re
from langchain_groq import ChatGroq
from app.models.schemas import ResortTelemetry
from app.orchestra.tools.search_api import search_tool  # Assuming you have a standard search tool

def gather_resort_telemetry(resort_name: str) -> dict:
    """
    Scrapes the web for live weather, snow depth, lift status, and historical snowfall 
    for the requested resort, and parses it into the ResortTelemetry schema.
    """
    print(f"🛰️ [Telemetry Officer] Initializing scan for: {resort_name}")

    # Step 1: Gather raw intel using your tools
    search_query = f"{resort_name} current snow report weather open lifts historical snowfall"
    
    # Use .invoke() and pass the argument as a dictionary mapped to the function's parameter name
    search_results = search_tool.invoke({"query": search_query})
    
    # EXTRACT URLs PROGRAMMATICALLY
    # Use Regex to find all instances of "URL: " followed by the web address
    extracted_urls = re.findall(r"URL: (http[s]?://[^\s]+)", search_results)
    
    # Deduplicate the list while preserving order (in case Tavily returns duplicates)
    unique_urls = list(dict.fromkeys(extracted_urls))
    
    # We provide the LLM with the raw data it needs to extract the metrics
    raw_context = f"Resort: {resort_name}\nSearch Intel:\n{search_results}"

    # Step 2: Initialize the LLM with structured output
    llm = ChatGroq(
        model="meta-llama/llama-4-scout-17b-16e-instruct", # Use your preferred model
        temperature=0.1, # Keep it low for factual data extraction
        api_key=os.environ.get("GROQ_API_KEY")
    )
    
    # Bind the Pydantic schema to force the output format
    structured_llm = llm.with_structured_output(ResortTelemetry)

    # Step 3: Prompt the LLM
    prompt = f"""
    You are the Telemetry Officer for a high-tech ski scouting application.
    Extract the live weather, snow conditions, and lift status for the following resort from the raw context provided.
    
    CRITICAL REQUIREMENT: For the 'historical_4_weeks' array, you MUST extract or logically estimate the daily snowfall 
    amounts (in cm) for the past 4 weeks. If exact daily data is missing, provide a realistic distribution of recent snowfalls based on the context to build a visually appealing bar chart.
    
    Context:
    {raw_context}
    """

    print(f"🧠 [Telemetry Officer] Parsing data streams...")
    result = structured_llm.invoke(prompt)
    
    # Step 4: Inject the URLs into the final output dictionary
    output_dict = result.model_dump()
    output_dict["source_urls"] = unique_urls
    
    print(f"✅ [Telemetry Officer] Data extracted successfully. Captured {len(unique_urls)} source URLs.")
    return output_dict