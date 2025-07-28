from sanic import Blueprint
from sanic.response import json
from pydantic import ValidationError
from modules.models import TierListCreate, TierListResponse, TierListUpdate, ItemPlacement, TierCreate, TierItem
from datetime import datetime

tierlists_bp = Blueprint("tierlists", url_prefix="/api/tierlists")

# In-memory storage for demo
tierlists_storage = []
tierlist_placements = {}
tierlist_id_counter = 1


@tierlists_bp.post("/")
async def create_tierlist(request):
    """Create a new tier list (classic discrete or dynamic continuous)"""
    try:
        tierlist_data = TierListCreate(**request.json)

        global tierlist_id_counter
        new_tierlist = {
            "id": tierlist_id_counter,
            "title": tierlist_data.title,
            "description": tierlist_data.description,
            "banner_image": getattr(tierlist_data, "banner_image", None),
            "list_type": tierlist_data.list_type,
            "tiers": [tier.model_dump() for tier in tierlist_data.tiers],
            "items": [item.model_dump() for item in tierlist_data.items],
            "created_at": datetime.utcnow().isoformat()
        }

        tierlist_placements[tierlist_id_counter] = []

        tierlists_storage.append(new_tierlist)

        response_data = {
            **new_tierlist,
            "item_placements": []
        }

        tierlist_id_counter += 1

        response = TierListResponse(**response_data)
        return json(response.model_dump(), status=201)

    except ValidationError as e:
        return json({"error": "Validation failed", "details": e.errors()}, status=400)


@tierlists_bp.get("/")
async def get_tierlists(request):
    """Get all tier lists"""
    tierlists_with_placements = []

    for tierlist in tierlists_storage:
        placements = tierlist_placements.get(tierlist["id"], [])
        tierlist_data = {
            **tierlist,
            "item_placements": [p.model_dump() if hasattr(p, 'model_dump') else p for p in placements]
        }
        tierlists_with_placements.append(tierlist_data)

    return json(tierlists_with_placements)


@tierlists_bp.get("/<tierlist_id:int>")
async def get_tierlist(request, tierlist_id: int):
    """Get a specific tier list"""
    tierlist = next(
        (t for t in tierlists_storage if t["id"] == tierlist_id), None)
    if not tierlist:
        return json({"error": "Tier list not found"}, status=404)

    placements = tierlist_placements.get(tierlist_id, [])
    tierlist_data = {
        **tierlist,
        "item_placements": [p.model_dump() if hasattr(p, 'model_dump') else p for p in placements]
    }

    return json(tierlist_data)


@tierlists_bp.put("/<tierlist_id:int>/placements")
async def update_tierlist_placements(request, tierlist_id: int):
    """Update item placements in a tier list"""
    try:
        update_data = TierListUpdate(**request.json)

        tierlist = next(
            (t for t in tierlists_storage if t["id"] == tierlist_id), None)
        if not tierlist:
            return json({"error": "Tier list not found"}, status=404)

        # FIX: Check by item["id"], not the dict itself
        valid_item_ids = {item["id"] for item in tierlist["items"]}
        for placement in update_data.item_placements:
            if placement.item_id not in valid_item_ids:
                return json({
                    "error": "Invalid item",
                    "details": f"Item '{placement.item_id}' not found in tier list"
                }, status=400)

        tierlist_placements[tierlist_id] = update_data.item_placements

        tierlist_data = {
            **tierlist,
            "item_placements": [p.model_dump() for p in update_data.item_placements]
        }

        response = TierListResponse(**tierlist_data)
        return json(response.model_dump())

    except ValidationError as e:
        return json({"error": "Validation failed", "details": e.errors()}, status=400)


@tierlists_bp.post("/<tierlist_id:int>/items")
async def add_item_to_tierlist(request, tierlist_id: int):
    """Add a new item to an existing tier list"""
    try:
        item_name = request.json.get("item_name")
        if not item_name:
            return json({"error": "item_name is required"}, status=400)

        tierlist = next(
            (t for t in tierlists_storage if t["id"] == tierlist_id), None)
        if not tierlist:
            return json({"error": "Tier list not found"}, status=404)

        if item_name in tierlist["items"]:
            return json({"error": "Item already exists"}, status=400)

        tierlist["items"].append(item_name)

        return json({"message": "Item added", "item": item_name})

    except Exception as e:
        return json({"error": "Failed to add item", "details": str(e)}, status=500)


@tierlists_bp.delete("/<tierlist_id:int>/items/<item_name>")
async def remove_item_from_tierlist(request, tierlist_id: int, item_name: str):
    """Remove an item from a tier list"""
    tierlist = next(
        (t for t in tierlists_storage if t["id"] == tierlist_id), None)
    if not tierlist:
        return json({"error": "Tier list not found"}, status=404)

    if item_name not in tierlist["items"]:
        return json({"error": "Item not found"}, status=404)

    tierlist["items"].remove(item_name)

    if tierlist_id in tierlist_placements:
        tierlist_placements[tierlist_id] = [
            p for p in tierlist_placements[tierlist_id]
            if (p.item_id if hasattr(p, 'item_id') else p.get('item_id')) != item_name
        ]

    return json({"message": "Item removed", "item": item_name})


@tierlists_bp.delete("/<tierlist_id:int>")
async def delete_tierlist(request, tierlist_id: int):
    """Delete a tier list"""
    global tierlists_storage, tierlist_placements

    tierlist = next(
        (t for t in tierlists_storage if t["id"] == tierlist_id), None)
    if not tierlist:
        return json({"error": "Tier list not found"}, status=404)

    # Remove from storage
    tierlists_storage = [
        t for t in tierlists_storage if t["id"] != tierlist_id]

    # Remove placements
    if tierlist_id in tierlist_placements:
        del tierlist_placements[tierlist_id]

    return json({"message": "Tier list deleted successfully"})
