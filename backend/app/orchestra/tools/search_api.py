import os
from langchain.tools import tool
from tavily import TavilyClient
from dotenv import load_dotenv

load_dotenv()

# 1. Initialize the raw Tavily client directly (bypassing Langchain's wrapper)
tavily_api_key = os.environ.get("TAVILY_API_KEY")
if not tavily_api_key:
    raise ValueError("TAVILY_API_KEY is missing from the environment variables.")

tavily_client = TavilyClient(api_key=tavily_api_key)

# 2. Wrap it in a clean @tool decorator so CrewAI's Pydantic v2 accepts it
@tool("Search the Web")
def search_tool(query: str) -> str:  
    """
    Search the internet for hidden gem ski resorts, chalets, local tourism boards, and prices.
    Pass a highly specific search query as a string.
    """
    try:
        # Perform the search
        response = tavily_client.search(query=query, max_results=5)
        
        # Format the results into a clean string for the LLM to read
        results = []
        for item in response.get("results", []):
            results.append(f"Title: {item['title']}\nURL: {item['url']}\nContent: {item['content']}\n")
            
        return "\n".join(results)
    
    except Exception as e:
        return f"Search failed: {str(e)}"