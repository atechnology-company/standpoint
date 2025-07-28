import os
import httpx
from typing import List, Optional

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

class GeminiAPIError(Exception):
    pass

async def gemini_generate_content(
    prompt: str,
    system_instruction: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 3072,
    stop_sequences: Optional[List[str]] = None,
    model: str = "gemini-2.5-flash-lite"
) -> str:
    """
    Calls the Gemini API with the given prompt and returns the generated text.

    Args:
        prompt (str): The user prompt.
        system_instruction (Optional[str]): Optional system instruction.
        temperature (float): Sampling temperature.
        max_tokens (int): Maximum tokens to generate.
        stop_sequences (Optional[List[str]]): Optional stop sequences.
        model (str): Model name (default: gemini-2.5-flash).

    Returns:
        str: The generated text.

    Raises:
        GeminiAPIError: If the API call fails.
    """
    if not GEMINI_API_KEY:
        raise GeminiAPIError("GEMINI_API_KEY environment variable not set.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }

    contents = []
    if system_instruction:
        contents.append({"role": "system", "parts": [{"text": system_instruction}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        }
    }
    if stop_sequences:
        payload["generationConfig"]["stopSequences"] = stop_sequences

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            raise GeminiAPIError(f"Gemini API error: {response.status_code} {response.text}")

        data = response.json()
        try:
            candidates = data["candidates"]
            if not candidates:
                raise GeminiAPIError("No candidates returned from Gemini API.")
            return candidates[0]["content"]["parts"][0]["text"]
        except Exception as e:
            raise GeminiAPIError(f"Malformed Gemini API response: {data}") from e
