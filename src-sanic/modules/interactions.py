from pydantic import BaseModel, ValidationError
from sanic.response import json
from sanic import Blueprint

interactions_bp = Blueprint("interactions", url_prefix="/api/interactions")

# In-memory storage for demo: {(type, id): like_count}
# type is "poll" or "tierlist"
item_likes = {}


class LikeRequest(BaseModel):
    item_id: int
    item_type: str  # "poll" or "tierlist"


@interactions_bp.post("/like")
async def like_item(request):
    """
    Like an item (poll or tierlist). Increments like count for the item.
    """
    try:
        data = LikeRequest(**request.json)
        key = (data.item_type, data.item_id)
        if key not in item_likes:
            item_likes[key] = 0
        item_likes[key] += 1
        return json({"message": "Item liked", "item_id": data.item_id, "item_type": data.item_type, "likes": item_likes[key]})
    except ValidationError as e:
        return json({"error": "Validation failed", "details": e.errors()}, status=400)


@interactions_bp.post("/unlike")
async def unlike_item(request):
    """
    Unlike an item (poll or tierlist). Decrements like count for the item, min 0.
    """
    try:
        data = LikeRequest(**request.json)
        key = (data.item_type, data.item_id)
        if key not in item_likes:
            item_likes[key] = 0
        item_likes[key] = max(0, item_likes[key] - 1)
        return json({"message": "Item unliked", "item_id": data.item_id, "item_type": data.item_type, "likes": item_likes[key]})
    except ValidationError as e:
        return json({"error": "Validation failed", "details": e.errors()}, status=400)


@interactions_bp.get("/<item_type:str>/<item_id:int>/likes")
async def get_item_likes(request, item_type: str, item_id: int):
    """
    Get the number of likes for an item (poll or tierlist).
    """
    key = (item_type, item_id)
    likes = item_likes.get(key, 0)
    return json({"item_id": item_id, "item_type": item_type, "likes": likes})
