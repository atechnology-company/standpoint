from sanic import Blueprint
from sanic.response import json
from sanic.request import Request
from pydantic import BaseModel, ValidationError
from typing import List, Optional


from .api import gemini_generate_content, GeminiAPIError

gemini_bp = Blueprint("gemini", url_prefix="/api/gemini")

# === Pydantic models ===

class TierlistSuggestRequest(BaseModel):
    title: str
    used_items: Optional[List[str]] = None
    n: int = 20  # how many suggestions to request (default 20)

class GeminiSuggestionItem(BaseModel):
    name: str
    image: bool
    image_query: Optional[str] = None

class TierlistSuggestResponse(BaseModel):
    items: List[GeminiSuggestionItem]

# === Helper: Prompt builder ===

def build_tierlist_prompt(title: str, used_items: Optional[List[str]], n: int) -> str:
    used = (
        f"\nAlready suggested/used items (do not repeat): {', '.join(used_items)}"
        if used_items else ""
    )
    prompt = (
        f"I'm creating a tier list titled \"{title}\".{used}\n"
        f"1. Suggest {n} items that would be appropriate for this tier list.\n"
        "2. For each item, indicate if an image would be appropriate (true/false).\n"
        "3. If images are appropriate, suggest a short search query for finding a representative image.\n"
        "Respond ONLY in JSON:\n"
        "{\n"
        "  \"items\": [\n"
        "    { \"name\": \"...\", \"image\": true/false, \"image_query\": \"...\" }\n"
        "  ]\n"
        "}\n"
        "You MUST respond with only the JSON object and nothing else. Do not add any explanation, code block, or extra text."
    )
    return prompt

# === Endpoint ===

@gemini_bp.post("/tierlist-suggest")
async def tierlist_suggest(request: Request):
    try:
        req = TierlistSuggestRequest(**request.json)
    except ValidationError as e:
        return json({"error": "Validation failed", "details": e.errors(), "raw": str(e)}, status=400)

    prompt = build_tierlist_prompt(req.title, req.used_items, req.n)

    gemini_response = None
    try:
        gemini_response = await gemini_generate_content(prompt)
    except GeminiAPIError as e:
        return json({
            "error": "Gemini API error",
            "details": str(e),
            "raw": getattr(e, "raw_response", None) or gemini_response or str(e)
        }, status=500)
    except Exception as e:
        return json({
            "error": "Unknown error",
            "details": str(e),
            "raw": gemini_response or str(e)
        }, status=500)

    # Parse Gemini's JSON response
    import json as pyjson
    try:
        import re
        if gemini_response is None:
            raise ValueError("Gemini response is None.")
        cleaned = re.sub(r"```(?:json)?", "", gemini_response or "", flags=re.IGNORECASE)
        cleaned = re.sub(r"```", "", cleaned)
        match = re.search(r"\{[\s\S]+\}", cleaned)
        if not match:
            raise ValueError("No JSON object found in Gemini response.")
        json_str = match.group(0)
        data = pyjson.loads(json_str)
        items = data.get("items", [])
        validated_items = [GeminiSuggestionItem(**item) for item in items]
        resp = TierlistSuggestResponse(items=validated_items)
        return json(resp.model_dump())
    except Exception as e:
        return json({
            "error": "Failed to parse Gemini response",
            "details": str(e),
            "raw": gemini_response if 'gemini_response' in locals() else None
        }, status=500)
