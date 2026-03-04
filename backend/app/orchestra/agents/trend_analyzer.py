import json
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from typing import List

# Define the exact schema the Frontend expects
class HotResort(BaseModel):
    name: str = Field(description="Name of the resort (must be a major European resort)")
    metric: str = Field(description="Short metric, e.g., '60cm POWDER', 'BLUEBIRD', 'NEW BASE'")
    condition: str = Field(description="Short condition tag, e.g., 'DUMPING', 'CLEAR', 'STABLE'")
    color: str = Field(description="Tailwind text color class, ONLY use: 'text-cyan-400', 'text-yellow-400', 'text-green-400', 'text-pink-400', or 'text-orange-400'")
    border: str = Field(description="Tailwind border color class, ONLY use: 'border-cyan-500', 'border-yellow-500', 'border-green-500', 'border-pink-500', or 'border-orange-500'")

class TrendingOutput(BaseModel):
    resorts: List[HotResort]

def trend_analyzer_node(state: dict, llm, tools: list) -> dict:
    """Scrapes the web for the top 3 trending ski resorts right now."""
    print("📡 [Trend Analyzer] Scanning global network for powder anomalies...")
    
    search_tool = tools[0] # Assuming web_search is passed in
    
    # 1. Execute the search
    search_query = "Best ski conditions Europe right now powder alerts massive snowfall incoming"
    search_results = search_tool.invoke(search_query)
    
    # 2. Instruct the LLM to parse and structure the data
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are the Lead Telemetry Analyst for a high-tech ski scouting app.
        Based on the latest web search context, identify the top 3 most attractive ski resorts in Europe right now.
        Look for incoming snow, current powder, or exceptional bluebird conditions.
        
        CRITICAL RULES:
        - Output exactly 3 resorts each in different countries. If a resort is in a similar country as the other, drop it.
        - Keep the metric and condition very short and punchy (max 2 words each) CRITICAL: don't mention any snow height - be creative.
        - Assign a fitting color theme to each based on the vibe (e.g., cyan/white for snow, yellow/orange for sun, green for open/stable).
        """),
        ("user", "Context from recent scan:\n{context}\n\nExtract the top 3 trending resorts.")
    ])
    
    structured_llm = llm.with_structured_output(TrendingOutput)
    chain = prompt | structured_llm
    
    result = chain.invoke({"context": search_results})
    
    print("✅ [Trend Analyzer] High Priority targets acquired.")
    return {"trending_resorts": result.model_dump()}