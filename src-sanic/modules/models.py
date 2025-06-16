from pydantic import BaseModel, Field
from typing import Optional, List, Literal

# Poll Models
class GradientConfig(BaseModel):
    colors: List[str] = Field(default=["#ff5705", "#0066cc"], description="Gradient colors")
    enabled: bool = Field(default=False, description="Whether gradient is enabled")

class PollCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    response_type: Literal[2, 3, 4, 5] = Field(..., description="Number of response options (2=line, 3=triangle, 4=square, 5=pentagon)")
    options: List[str] = Field(..., min_items=2, max_items=5, description="The labels for each response option")
    gradients: Optional[GradientConfig] = Field(default=None, description="Gradient configuration for background")
    
class VoteCreate(BaseModel):
    poll_id: int
    position: float = Field(..., ge=0.0, le=1.0, description="Position on the scale (0.0 to 1.0)")
    position_2d: Optional[dict] = Field(None, description="2D coordinates for square voting {x: float, y: float}")
    
class PollStats(BaseModel):
    average: float = Field(description="Public average position")
    std_dev: float = Field(description="Standard deviation")
    total_votes: int
    vote_positions: List[float] = Field(description="All vote positions for rendering")
    vote_positions_2d: Optional[List[dict]] = Field(None, description="2D vote positions for square polls")
    average_2d: Optional[List[float]] = Field(None, description="Average 2D position [x, y] for polygon charts")
    
class PollResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    response_type: int
    options: List[str]
    stats: PollStats
    user_vote: Optional[float] = Field(None, description="Current user's vote position if any")
    user_vote_2d: Optional[dict] = Field(None, description="Current user's 2D vote position if any")
    created_at: str 
    gradients: Optional[GradientConfig] = Field(default=None, description="Gradient configuration for background")

# TierList Models
class TierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    position: float = Field(..., description="Position for dynamic tierlists (0.0 to 1.0)")
    
class ItemPlacement(BaseModel):
    item_id: str
    tier_position: float = Field(..., description="Position within tier (0.0 to 1.0 for dynamic, tier index for classic)")
    
class TierListCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    list_type: Literal["classic", "dynamic"] = Field(..., description="Classic = discrete tiers, Dynamic = continuous positioning")
    tiers: List[TierCreate] = Field(..., min_items=2, max_items=10)
    items: List[str] = Field(..., min_items=1, description="Available items to rank")
    
class TierListUpdate(BaseModel):
    item_placements: List[ItemPlacement] = Field(..., description="Updated positions of items")
    
class TierListResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    list_type: str
    tiers: List[TierCreate]
    items: List[str]
    item_placements: List[ItemPlacement]
    created_at: str 
    
class ErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None
