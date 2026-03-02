import json
from app.models.schemas import Phase2Result

def evaluator_node(state: dict, llm) -> dict:
    print("\n⚖️ [EVALUATOR] Enforcing strict requirements and validating schema...")
    criteria = state.get("criteria", {})
    raw_text = state.get("raw_chalets", "No data found.")
    personality = state.get("user_personality", "")
    target_resort = state.get("target_resort", "Unknown Resort")

    # Short-circuit if the hunter failed completely
    if len(raw_text) < 50 or "Hunter encountered an error" in raw_text:
        print("⚠️ [EVALUATOR] Raw text insufficient. Returning empty safe fallback.")
        return {"final_chalets": {"resort_name": target_resort, "chalets": []}}

    refiner = llm.with_structured_output(Phase2Result)

    persona_instruction = ""
    if personality:
        persona_instruction = f"- User Personality/Vibe: {personality}\n(CRITICAL: Boost the 'hidden_gem_score' significantly if the chalet strongly matches this personality!)\n"

    prompt = (
        f"Evaluate this raw data for {target_resort}:\n\n"
        f"RAW TEXT:\n{raw_text}\n\n"
        f"CRITERIA:\n"
        f"- Max Budget: {criteria.get('max_budget_per_night', 'N/A')} EUR/night\n"
        f"{persona_instruction}\n"
        "CRITICAL RULES FOR SCORING & SCHEMA:\n"
        "1. URL CHECK (THE HIDDEN GEM RULE): Look closely at the URL. If the URL is a broad region page (e.g., booking.com/region/..., airbnb.com/s/...), you MUST give it a 'hidden_gem_score' of 1 or 2. If it is a direct, independent property website, boost the score to 8, 9, or 10.\n"
        "2. 'hidden_gem_score' MUST be a whole INTEGER between 1 and 10. NO decimals.\n"
        "3. You MUST include ALL keys in your JSON response. If data is missing, explicitly write null.\n"
        "4. ONLY output the tool call."
    )

    try:
        result = refiner.invoke(prompt)
        print("✨ [EVALUATOR] Schema validation successful.")
        return {"final_chalets": result.model_dump()}
        
    except Exception as e:
        print(f"🔥 [EVALUATOR CRASH PREVENTED] Validation or LLM parsing failed: {e}")
        # The ultimate fail-safe: Hand the frontend a clean, valid JSON structure with 0 results
        # so the UI can show a "No chalets found" message instead of a terrifying 500 error screen.
        fallback_payload = {
            "resort_name": target_resort,
            "chalets": []
        }
        return {"final_chalets": fallback_payload}