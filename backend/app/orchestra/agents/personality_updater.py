from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq

def update_user_profile(current_profile: str, new_feedback: dict, llm: ChatGroq) -> str:
    """
    Analyzes a user's latest interaction and updates their personality profile.
    """
    thumb = new_feedback.get("thumb_status", "up")
    reason = new_feedback.get("reason", "No specific reason provided.")
    
    # Handle the case where this is the user's very first interaction
    if not current_profile or current_profile.strip() == "":
        current_profile = "No known preferences yet."

    prompt = (
        f"You are an AI analyzing a skier's preferences for their winter holidays. "
        f"Their current profile is: '{current_profile}'. \n\n"
        f"They just gave a thumbs {thumb} to a specific chalet because: '{reason}'. \n\n"
        f"Update their profile summary to reflect this new preference. "
        f"Merge it logically with their past preferences. Keep it concise, actionable, "
        f"and written in the third person (e.g., 'The user prefers...'). Do not include greetings."
    )
    
    response = llm.invoke([HumanMessage(content=prompt)])
    return response.content.strip()