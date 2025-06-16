from sanic import Blueprint
from sanic.response import json
from pydantic import ValidationError
from modules.models import PollCreate, PollResponse, VoteCreate, PollStats
from datetime import datetime

polls_bp = Blueprint("polls", url_prefix="/api/polls")

# In-memory storage for demo 
polls_storage = []
votes_storage = {}
votes_2d_storage = {}
user_votes_storage = {}
poll_id_counter = 1

def calculate_poll_stats(poll_id: int) -> PollStats:
    """Calculate statistics for a poll"""
    votes = votes_storage.get(poll_id, [])
    votes_2d = votes_2d_storage.get(poll_id, [])
    
    if not votes:
        return PollStats(
            average=0.5,
            std_dev=0.0,
            total_votes=0,
            vote_positions=[],
            vote_positions_2d=[],
            average_2d=None
        )
    
    average = sum(votes) / len(votes)
    
    if len(votes) > 1:
        variance = sum((x - average) ** 2 for x in votes) / (len(votes) - 1)
        std_dev = variance ** 0.5
    else:
        std_dev = 0.0
    
    average_2d = None
    if votes_2d:
        try:
            if isinstance(votes_2d[0], dict):
                avg_x = sum(pos['x'] for pos in votes_2d) / len(votes_2d)
                avg_y = sum(pos['y'] for pos in votes_2d) / len(votes_2d)
            else:
                avg_x = sum(pos[0] for pos in votes_2d) / len(votes_2d)
                avg_y = sum(pos[1] for pos in votes_2d) / len(votes_2d)
            average_2d = [avg_x, avg_y]
        except (KeyError, IndexError, TypeError):
            average_2d = None
    
    return PollStats(
        average=average,
        std_dev=std_dev,
        total_votes=len(votes),
        vote_positions=votes.copy(),
        vote_positions_2d=votes_2d.copy() if votes_2d else None,
        average_2d=average_2d
    )

@polls_bp.post("/")
async def create_poll(request):
    """Create a new visual preference scale poll"""
    try:
        poll_data = PollCreate(**request.json)
        
        if len(poll_data.options) != poll_data.response_type:
            return json({
                "error": "Validation failed", 
                "details": f"Number of options ({len(poll_data.options)}) must match response_type ({poll_data.response_type})"
            }, status=400)
        
        global poll_id_counter
        new_poll = {
            "id": poll_id_counter,
            "title": poll_data.title,
            "description": poll_data.description,
            "response_type": poll_data.response_type,
            "options": poll_data.options,
            "gradients": poll_data.gradients.model_dump() if poll_data.gradients else None,
            "created_at": datetime.utcnow().isoformat()
        }
        
        polls_storage.append(new_poll)
        votes_storage[poll_id_counter] = []
        votes_2d_storage[poll_id_counter] = []
        user_votes_storage[poll_id_counter] = None
        
        stats = calculate_poll_stats(poll_id_counter)
        response_data = {**new_poll, "stats": stats.model_dump(), "user_vote": None, "user_vote_2d": None}
        
        poll_id_counter += 1
        
        response = PollResponse(**response_data)
        return json(response.model_dump(), status=201)
        
    except ValidationError as e:
        return json({"error": "Validation failed", "details": e.errors()}, status=400)

@polls_bp.get("/")
async def get_polls(request):
    """Get all polls with current statistics"""
    polls_with_stats = []
    
    for poll in polls_storage:
        stats = calculate_poll_stats(poll["id"])
        user_vote_data = user_votes_storage.get(poll["id"])
        user_vote = user_vote_data["position"] if user_vote_data else None
        user_vote_2d = user_vote_data["position_2d"] if user_vote_data and "position_2d" in user_vote_data else None
        poll_data = {**poll, "stats": stats.model_dump(), "user_vote": user_vote, "user_vote_2d": user_vote_2d}
        polls_with_stats.append(poll_data)
    
    return json(polls_with_stats)

@polls_bp.get("/<poll_id:int>")
async def get_poll(request, poll_id: int):
    """Get a specific poll with statistics"""
    poll = next((p for p in polls_storage if p["id"] == poll_id), None)
    if not poll:
        return json({"error": "Poll not found"}, status=404)
    
    stats = calculate_poll_stats(poll_id)
    user_vote_data = user_votes_storage.get(poll_id)
    user_vote = user_vote_data["position"] if user_vote_data else None
    user_vote_2d = user_vote_data["position_2d"] if user_vote_data and "position_2d" in user_vote_data else None
    poll_data = {**poll, "stats": stats.model_dump(), "user_vote": user_vote, "user_vote_2d": user_vote_2d}
    
    return json(poll_data)

@polls_bp.delete("/<poll_id:int>")
async def delete_poll(request, poll_id: int):
    """Delete a specific poll"""
    global polls_storage
    
    poll_index = next((i for i, p in enumerate(polls_storage) if p["id"] == poll_id), None)
    if poll_index is None:
        return json({"error": "Poll not found"}, status=404)
    
    polls_storage.pop(poll_index)
    
    if poll_id in votes_storage:
        del votes_storage[poll_id]
    if poll_id in votes_2d_storage:
        del votes_2d_storage[poll_id]
    if poll_id in user_votes_storage:
        del user_votes_storage[poll_id]
    
    return json({"message": "Poll deleted successfully"})

@polls_bp.post("/<poll_id:int>/vote")
async def vote_on_poll(request, poll_id: int):
    """Submit a position vote on the preference scale"""
    try:
        vote_json = request.json.copy()
        if 'poll_id' in vote_json:
            del vote_json['poll_id']
        vote_data = VoteCreate(poll_id=poll_id, **vote_json)
        
        poll = next((p for p in polls_storage if p["id"] == poll_id), None)
        if not poll:
            return json({"error": "Poll not found"}, status=404)
        
        if poll_id not in votes_storage:
            votes_storage[poll_id] = []
        
        votes_storage[poll_id].append(vote_data.position)
        
        if vote_data.position_2d and poll["response_type"] in [3, 4, 5]:
            if poll_id not in votes_2d_storage:
                votes_2d_storage[poll_id] = []
            votes_2d_storage[poll_id].append(vote_data.position_2d)
        
        user_votes_storage[poll_id] = {
            "position": vote_data.position,
            "position_2d": vote_data.position_2d if vote_data.position_2d else None
        }
        
        stats = calculate_poll_stats(poll_id)
        user_vote_data = user_votes_storage.get(poll_id)
        user_vote = user_vote_data["position"] if user_vote_data else None
        user_vote_2d = user_vote_data["position_2d"] if user_vote_data and "position_2d" in user_vote_data else None
        poll_data = {**poll, "stats": stats.model_dump(), "user_vote": user_vote, "user_vote_2d": user_vote_2d}
        
        response = PollResponse(**poll_data)
        
        return json({
            "message": "Vote recorded", 
            "poll": response.model_dump()
        })
        
    except ValidationError as e:
        return json({"error": "Validation failed", "details": e.errors()}, status=400)

@polls_bp.get("/<poll_id:int>/stats")
async def get_poll_stats(request, poll_id: int):
    """Get detailed statistics for a poll"""
    poll = next((p for p in polls_storage if p["id"] == poll_id), None)
    if not poll:
        return json({"error": "Poll not found"}, status=404)
    
    stats = calculate_poll_stats(poll_id)
    
    votes = votes_storage.get(poll_id, [])
    histogram_data = {}
    
    if votes:
        num_bins = 20
        for i in range(num_bins):
            bin_start = i / num_bins
            bin_end = (i + 1) / num_bins
            count = sum(1 for vote in votes if bin_start <= vote < bin_end)
            histogram_data[f"bin_{i}"] = count
    
    return json({
        "stats": stats.model_dump(),
        "histogram": histogram_data,
        "confidence_interval_95": {
            "lower": max(0.0, stats.average - 1.96 * stats.std_dev) if stats.std_dev > 0 else stats.average,
            "upper": min(1.0, stats.average + 1.96 * stats.std_dev) if stats.std_dev > 0 else stats.average
        },
        "standard_deviation_bounds": {
            "lower": max(0.0, stats.average - 1.5 * stats.std_dev) if stats.std_dev > 0 else stats.average,
            "upper": min(1.0, stats.average + 1.5 * stats.std_dev) if stats.std_dev > 0 else stats.average
        }
    })
