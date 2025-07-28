import aiohttp
from sanic import Blueprint, response
from sanic.request import Request

bp = Blueprint("firebase_proxy")

FRONTEND_FIREBASE_ENDPOINT = "http://localhost:5173/api/firebase/poll"

@bp.post("/api/polls")
async def create_poll(request: Request):
    """
    Receives poll creation requests and forwards them to the frontend's Firebase endpoint.
    """
    try:
        poll_data = request.json
    except Exception:
        return response.json({"error": "Invalid JSON"}, status=400)

    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(FRONTEND_FIREBASE_ENDPOINT, json=poll_data) as resp:
                data = await resp.text()
                return response.raw(
                    data.encode(),
                    status=resp.status,
                    content_type=resp.content_type or "application/json"
                )
        except Exception as e:
            return response.json({"error": f"Failed to contact frontend: {str(e)}"}, status=502)
