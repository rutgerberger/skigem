import os
from typing import TypedDict, List
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END

from app.orchestra.tools.search_api import search_tool
from app.orchestra.agents.resort_scout import resort_scout_node
from app.orchestra.agents.chalet_hunter import chalet_hunter_node
from app.orchestra.agents.evaluator import evaluator_node
from app.orchestra.tools.sheets_sync import append_to_sheets
from app.orchestra.tools.web_scraper import scrape_website
from app.orchestra.agents.trend_analyzer import trend_analyzer_node

load_dotenv()

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.2, api_key=os.environ.get("GROQ_API_KEY"))

@tool("web_search")
def web_search(query: str) -> str:
    """
    Searches the web for up-to-date information about ski resorts, 
    slope lengths, altitudes, town vibes, logistics, and chalet prices.
    """
    print(f"   🔍 [Web Search] {query}")
    return search_tool.run(query)

# ==========================================
# PHASE A: SCOUT GRAPH
# ==========================================
class ScoutState(TypedDict):
    criteria: dict
    final_resorts: dict

scout_workflow = StateGraph(ScoutState)
scout_workflow.add_node("resort_scout", lambda state: resort_scout_node(state, llm, [web_search]))
scout_workflow.add_edge(START, "resort_scout")
scout_workflow.add_edge("resort_scout", END)
phase_a_graph = scout_workflow.compile()

# ==========================================
# PHASE B: HUNTER GRAPH
# ==========================================
class HunterState(TypedDict):
    criteria: dict
    target_resort: str
    raw_chalets: str
    final_chalets: dict
    user_personality: str

# Define the Sync Node
def sync_to_sheets_node(state: HunterState):
    """The final sink node in the graph."""
    resort = state.get("target_resort")
    data = state.get("final_chalets", {})
    chalets = data.get("chalets", [])
    
    if chalets:
        append_to_sheets(resort, chalets)
        
    return state

hunter_workflow = StateGraph(HunterState)
hunter_workflow.add_node("chalet_hunter", lambda state: chalet_hunter_node(state, llm, [web_search, scrape_website]))
hunter_workflow.add_node("evaluator", lambda state: evaluator_node(state, llm))
hunter_workflow.add_node("sync", sync_to_sheets_node)
hunter_workflow.add_edge(START, "chalet_hunter")
hunter_workflow.add_edge("chalet_hunter", "evaluator")
hunter_workflow.add_edge("evaluator", "sync")
hunter_workflow.add_edge("sync", END)

phase_b_graph = hunter_workflow.compile()

# ==========================================
# PHASE C: TRENDING NETWORK GRAPH
# ==========================================
class TrendState(TypedDict):
    trending_resorts: dict

trend_workflow = StateGraph(TrendState)
trend_workflow.add_node("trend_analyzer", lambda state: trend_analyzer_node(state, llm, [web_search]))
trend_workflow.add_edge(START, "trend_analyzer")
trend_workflow.add_edge("trend_analyzer", END)

phase_c_graph = trend_workflow.compile()

def run_trend_analysis() -> dict:
    """Triggered twice a day or manually to find hot resorts."""
    print("\n" + "="*50 + "\n🔥 STARTING PHASE C: NETWORK TREND ANALYSIS\n" + "="*50)
    try:
        result = phase_c_graph.invoke({})
        return result.get("trending_resorts", {"resorts": []})
    except Exception as e:
        print(f"\n🚨 [SYSTEM FATAL] Trend analysis failed: {e}")
        # Return fallback data if the API fails
        return {
            "resorts": [
                { "name": "Verbier", "metric": "OFFLINE", "condition": "AWAITING DATA", "color": "text-slate-400", "border": "border-slate-500" }
            ]
        }
    
# ==========================================
# EXPORTED RUNNER FUNCTIONS FOR FASTAPI
# ==========================================
def run_phase_a_scout(criteria: dict) -> dict:
    print("\n" + "="*50 + "\n🎻 STARTING PHASE A: RESORT BRIEFING\n" + "="*50)
    result = phase_a_graph.invoke({"criteria": criteria})
    return result["final_resorts"]

def run_phase_b_hunter(criteria: dict, target_resort: str, user_personality: str = "") -> dict:
    print("\n" + "="*50 + f"\n⛷️ STARTING PHASE B: HUNTING IN {target_resort.upper()}\n" + "="*50)
    
    try:
        # Added a recursion limit configuration to prevent runaway graphs
        config = {"recursion_limit": 15}
        result = phase_b_graph.invoke({
            "criteria": criteria, 
            "target_resort": target_resort,
            "user_personality": user_personality
        }, config=config)
        
        return result.get("final_chalets", {"resort_name": target_resort, "chalets": []})
        
    except Exception as e:
        print(f"\n🚨 [SYSTEM FATAL] Graph execution completely failed: {e}")
        # Guarantee FastAPI never crashes
        return {"resort_name": target_resort, "chalets": []}