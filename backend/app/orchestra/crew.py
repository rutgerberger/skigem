# import os
# from crewai import Agent, Task, Crew, Process
# from crewai.tools import tool
# from langchain_groq import ChatGroq
# from dotenv import load_dotenv

# # Import our custom tool and schemas
# from app.orchestra.tools.search_api import search_tool
# from app.models.schemas import SearchResult

# load_dotenv()

# # 1. Initialize the ultra-fast Groq LLM
# llm = LLM(
#     model="groq/llama-3.3-70b-versatile",
#     temperature=0.2
#     # Note: You don't even need to pass the api_key here. 
#     # CrewAI/LiteLLM will automatically find GROQ_API_KEY in your environment!
# )
# @tool("Web Search")
# def web_search(query: str):
#     """Search the web for information."""
#     return search_tool.run(query)

# def run_skigem_orchestra(criteria: dict) -> dict:
#     """
#     Kicks off the multi-agent system to find ski resorts and chalets.
#     """
    
#     # ==========================================
#     # AGENTS
#     # ==========================================
#     resort_scout = Agent(
#         role='Expert Ski Resort Scout',
#         goal=f"Find the best lesser-known ski resort in {criteria['country']} with at least {criteria['min_slope_length_km']}km of slopes.",
#         backstory="You are a seasoned winter sports journalist who knows all the hidden ski areas that aren't overrun by tourists.",
#         verbose=True,
#         allow_delegation=False,
#         tools=[web_search],
#         llm=llm
#     )

#     chalet_hunter = Agent(
#         role='Deep-Web Chalet Hunter',
#         goal="Search local tourism sites, forums, and independent property listings to find standalone chalets in the selected ski resort.",
#         backstory="You are an internet sleuth who bypasses Booking.com and Airbnb. You know how to find direct-booking websites for authentic chalets.",
#         verbose=True,
#         allow_delegation=False,
#         tools=[web_search],
#         llm=llm
#     )

#     evaluator = Agent(
#         role='Strict Requirements Evaluator',
#         goal=f"Filter the found chalets. They MUST be under {criteria['max_budget_per_night']} EUR/night and within {criteria['lift_proximity_m']}m of a ski lift.",
#         backstory="You are a meticulous travel agent. If a chalet does not meet the budget or distance requirements, you discard it ruthlessly.",
#         verbose=True,
#         allow_delegation=False,
#         llm=llm
#     )

#     # ==========================================
#     # TASKS
#     # ==========================================
#     task1 = Task(
#         description=f"Search the web to identify 1 ideal, lesser-known ski resort in {criteria['country']} that has at least {criteria['min_slope_length_km']}km of slopes.",
#         expected_output="The name of the resort and its total slope length in km.",
#         agent=resort_scout
#     )

#     task2 = Task(
#         description="Using the resort found in Task 1, search the internet for 3 hidden-gem chalets. Look for local listings. Extract the name, URL, price, and distance to the lift.",
#         expected_output="A raw list of 3 chalets with their details.",
#         agent=chalet_hunter
#     )

#     task3 = Task(
#         description=f"Review the chalets from Task 2. Filter out any that exceed {criteria['max_budget_per_night']} EUR/night or are further than {criteria['lift_proximity_m']}m from the lift. Score the remaining ones 1-10 on how much of a 'hidden gem' they are. Also consider these additional requirements: {criteria.get('additional_requirements', 'None')}",
#         expected_output="A perfectly formatted JSON object matching the SearchResult schema.",
#         agent=evaluator,
#         output_pydantic=SearchResult # This forces the LLM to return your exact Pydantic model!
#     )

#     # ==========================================
#     # THE ORCHESTRA (CREW)
#     # ==========================================
#     skigem_crew = Crew(
#         agents=[resort_scout, chalet_hunter, evaluator],
#         tasks=[task1, task2, task3],
#         process=Process.sequential, # Agents run one after another
#         verbose=True
#     )

#     # Start the crew
#     result = skigem_crew.kickoff()
    
#     # CrewAI returns a CrewOutput object; we want to return the raw Pydantic dict for FastAPI
#     return result.pydantic.model_dump() if result.pydantic else result.raw
import os
import json
from typing import TypedDict
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent

# Import our custom tool and schemas
from app.orchestra.tools.search_api import search_tool
from app.models.schemas import SearchResult

load_dotenv()

# 1. Initialize the ultra-fast Groq LLM
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.2,
    api_key=os.environ.get("GROQ_API_KEY")
)

# 2. Define the Tool
@tool("Web_Search")
def web_search(query: str) -> str:
    """Search the web for information about ski resorts and chalets."""
    print(f"   🔍 [Web Search Tool] Searching for: {query}")
    return search_tool.run(query)

# 3. Define the Graph State
class OrchestraState(TypedDict):
    criteria: dict
    resort_info: str
    raw_chalets: str
    final_result: dict

# ==========================================
# GRAPH NODES (The Agents)
# ==========================================

def resort_scout_node(state: OrchestraState) -> dict:
    print("\n⛷️ Agent 1: Resort Scout is dropping in...")
    criteria = state["criteria"]
    
    agent = create_react_agent(
        llm, 
        tools=[web_search],
        prompt="You are a seasoned winter sports journalist who knows all the hidden ski areas that aren't overrun by tourists."
    )
    
    prompt = f"Search the web to find 1 ideal, lesser-known ski resort in {criteria['country']} that has at least {criteria['min_slope_length_km']}km of slopes. Return ONLY the name of the resort and its total slope length in km."
    
    response = agent.invoke({"messages": [("user", prompt)]})
    resort_info = response["messages"][-1].content
    
    print(f"🎯 Target Acquired: {resort_info}")
    return {"resort_info": resort_info}

def chalet_hunter_node(state: OrchestraState) -> dict:
    print("\n🏡 Agent 2: Chalet Hunter is scouring the deep web...")
    
    agent = create_react_agent(
        llm, 
        tools=[web_search],
        prompt="You are an internet sleuth. You know how to find direct-booking websites for authentic chalets."
    )
    
    prompt = f"Based on this resort: {state['resort_info']}, search the internet for 3 hidden-gem standalone chalets. Look for local listings. Extract the name, URL, price per night, and distance to the lift. Return this as a raw list."
    
    response = agent.invoke({"messages": [("user", prompt)]})
    raw_chalets = response["messages"][-1].content
    
    print(f"✅ Found potential chalets!")
    return {"raw_chalets": raw_chalets}

def evaluator_node(state: OrchestraState) -> dict:
    print("\n⚖️ Agent 3: Evaluator is checking the requirements...")
    criteria = state["criteria"]
    
    structured_llm = llm.with_structured_output(SearchResult)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a meticulous travel agent. Review the provided chalets. Filter out any that exceed {budget} EUR/night or are further than {lift}m from the lift. Score the remaining ones 1-10 on how much of a 'gem' they are. Also consider these additional requirements: {reqs}."),
        ("user", "Resort Info: {resort_info}\n\nChalets: {raw_chalets}")
    ])
    
    chain = prompt | structured_llm
    
    result = chain.invoke({
        "budget": criteria['max_budget_per_night'],
        "lift": criteria['lift_proximity_m'],
        "reqs": criteria.get('additional_requirements', 'None'),
        "resort_info": state['resort_info'],
        "raw_chalets": state['raw_chalets']
    })
    
    print("✨ Evaluation complete. Formatting payload for Next.js...")
    # Result is a Pydantic object, we dump it to a dict for the state
    return {"final_result": result.model_dump()}

# ==========================================
# BUILD THE PIPELINE
# ==========================================

workflow = StateGraph(OrchestraState)

workflow.add_node("resort_scout", resort_scout_node)
workflow.add_node("chalet_hunter", chalet_hunter_node)
workflow.add_node("evaluator", evaluator_node)

workflow.add_edge(START, "resort_scout")
workflow.add_edge("resort_scout", "chalet_hunter")
workflow.add_edge("chalet_hunter", "evaluator")
workflow.add_edge("evaluator", END)

skigem_orchestra = workflow.compile()

def run_skigem_orchestra(criteria: dict) -> dict:
    """
    Kicks off the LangGraph system. Returns a dictionary perfectly 
    formatted to be unpacked into the SearchResult Pydantic model.
    """
    print("\n" + "="*50)
    print(f"🎻 ORCHESTRA STARTING: {criteria['country']} | Budget: €{criteria['max_budget_per_night']}")
    print("="*50)
    
    initial_state = {"criteria": criteria}
    final_state = skigem_orchestra.invoke(initial_state)
    
    print("\n🏁 Workflow Finished Successfully!")
    return final_state["final_result"]