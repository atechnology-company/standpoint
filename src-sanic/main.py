from sanic import Sanic
from sanic.response import json
from sanic_ext import Extend
from pydantic import BaseModel, ValidationError
import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("python-dotenv not installed. Create .env manually or install with: pip install python-dotenv")

# Import blueprints
from modules.polls import polls_bp
from modules.tierlists import tierlists_bp
from modules.interactions import interactions_bp
from modules.gemini.routes import gemini_bp

# Initialize Sanic app
app = Sanic("StandpointAPI")

# Configure ext
app.extend(
    config={
        "cors": {
            "origins": [os.getenv("FRONTEND_URL", "http://localhost:5173")],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }
    }
)

# Register blueprints
app.blueprint(polls_bp)
app.blueprint(tierlists_bp)
app.blueprint(interactions_bp)
app.blueprint(gemini_bp)

# Pydantic models


class HealthResponse(BaseModel):
    status: str
    message: str
    endpoints: list


class ErrorResponse(BaseModel):
    error: str
    details: str

# Health check endpoint


@app.get("/health")
async def health_check(request):
    response = HealthResponse(
        status="ok",
        message="Standpoint API is running",
        endpoints=[
            "/health",
            "/api/hello",
            "/api/polls",
            "/api/tierlists"
        ]
    )
    return json(response.model_dump())

# Example endpoint


@app.get("/api/hello")
async def hello(request):
    return json({"message": "Hello from Sanic backend!"})

# Error handler for validation errors


@app.exception(ValidationError)
async def validation_error_handler(request, exception):
    error_response = ErrorResponse(
        error="Validation Error",
        details=str(exception)
    )
    return json(error_response.model_dump(), status=400)

# Global error handler


@app.exception(Exception)
async def global_error_handler(request, exception):
    import traceback
    print(f"Error occurred: {exception}")
    print(f"Traceback: {traceback.format_exc()}")

    error_response = ErrorResponse(
        error="Internal Server Error", details=str(exception))
    return json(error_response.model_dump(), status=500)

if __name__ == "__main__":
    app.run(
        host=os.getenv("SANIC_HOST", "127.0.0.1"),
        port=int(os.getenv("SANIC_PORT", 8000)),
        debug=os.getenv("SANIC_DEBUG", "True").lower() == "true",
        auto_reload=os.getenv("SANIC_AUTO_RELOAD", "True").lower() == "true",
    )
