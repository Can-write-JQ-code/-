from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
from dotenv import load_dotenv
from pathlib import Path
import base64
from io import BytesIO
from PIL import Image

from services.dalle import DalleService
from services.stable_diffusion import StableDiffusionService
from services.gemini_image import GeminiImageService
from services.doubao_image import DoubaoImageService
from services.chat_service import ChatService

# Load environment variables (support running from repo root)
load_dotenv()
backend_env = Path(__file__).resolve().parent / ".env"
if backend_env.exists():
    load_dotenv(backend_env, override=True)

app = FastAPI(title="AI Image Generation API", version="1.0.0")

# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    # print(f"[DEBUG] Loaded GEMINI_API_KEY: {gemini_api_key}")
    print('')
else:
    print("[DEBUG] GEMINI_API_KEY not configured")

doubao_api_key = os.getenv("DOUBAO_API_KEY")
if doubao_api_key:
    # print(f"[DEBUG] Loaded DOUBAO_API_KEY: {doubao_api_key}")
    print(" ")
else:
    print("[DEBUG] DOUBAO_API_KEY not configured")

# Initialize AI services
dalle_service = DalleService(api_key=os.getenv("OPENAI_API_KEY"))
sd_service = StableDiffusionService(api_key=os.getenv("STABILITY_API_KEY"))
gemini_service = GeminiImageService(
    api_key=gemini_api_key,
    base_url=os.getenv("GEMINI_BASE_URL", "https://yunwu.ai"),
    model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash-image"),
    auth_mode=os.getenv("GEMINI_AUTH_MODE")
)
doubao_service = DoubaoImageService(
    api_key=doubao_api_key,
    base_url=os.getenv("DOUBAO_BASE_URL", "https://yunwu.ai"),
    model=os.getenv("DOUBAO_MODEL", "doubao-seedream-4-0-250828")
)

# Chat Service (uses CHAT_API_KEY if available, otherwise falls back to others)
chat_service = ChatService(
    api_key=os.getenv("CHAT_API_KEY") or gemini_api_key or os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("CHAT_BASE_URL", "https://yunwu.ai/v1"),
    model=os.getenv("CHAT_MODEL", "gpt-5-2025-08-07")
)

# Available services
SERVICES = {
    "dalle": dalle_service,
    "stable-diffusion": sd_service,
    "gemini-image": gemini_service,
    "doubao-image": doubao_service,
}


class ChatMessage(BaseModel):
    message: str
    service: Optional[str] = "dalle"  # Default to DALL-E
    model: Optional[str] = None  # Service specific model selection
    aspect_ratio: Optional[str] = "1:1"  # For Gemini
    image_size: Optional[str] = "1K"  # For Gemini
    reference_image: Optional[str] = None  # Base64 or data URL for image-to-image


class ImageGenerationRequest(BaseModel):
    prompt: str
    service: str = "dalle"
    model: Optional[str] = None
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    quality: Optional[str] = "standard"
    aspect_ratio: Optional[str] = "1:1"  # For Gemini: 1:1, 16:9, 9:16, 4:3, 3:4
    image_size: Optional[str] = "1K"  # For Gemini: 1K, 2K, 4K
    reference_image: Optional[str] = None  # Base64 encoded reference image


class TextChatRequest(BaseModel):
    messages: List[Dict[str, Any]]
    model: Optional[str] = None


@app.get("/")
async def root():
    """API health check"""
    return {
        "status": "online",
        "message": "AI Image Generation API",
        "available_services": list(SERVICES.keys()) + ["chat"]
    }


@app.get("/api/services")
async def get_services():
    """Get list of available AI services"""
    services_list = [
        {
            "id": key,
            "name": service.get_service_name(),
            "available": service.api_key is not None
        }
        for key, service in SERVICES.items()
    ]
    # Add Chat service
    services_list.append({
        "id": "chat",
        "name": "AI Chat (GPT-4o)",
        "available": chat_service.api_key is not None
    })
    return {"services": services_list}


@app.post("/api/text_chat")
async def text_chat(request: TextChatRequest):
    """
    Handle text/multimodal chat requests
    """
    try:
        print(f"[DEBUG] Received chat request with {len(request.messages)} messages")
        result = await chat_service.chat_completion(
            messages=request.messages,
            model=request.model
        )
        return result
    except Exception as e:
        print(f"[ERROR] Exception in text_chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat")
async def chat(message: ChatMessage):
    """
    Handle chat messages and generate images based on prompts
    """
    try:
        # Get the selected service
        service_key = message.service
        
        # Log the request
        print(f"[DEBUG] Received request - Service: {service_key}, Model: {message.model}")
        print(f"[DEBUG] Prompt: {message.message[:100]}...")
        print(f"[DEBUG] Aspect Ratio: {message.aspect_ratio}, Image Size: {message.image_size}")
        
        # For Gemini, create a new instance with the selected model
        if service_key == "gemini-image":
            gemini_api_key = os.getenv("GEMINI_API_KEY")
            # print(f"[DEBUG] Using GEMINI_API_KEY for this request: {gemini_api_key}")
            gemini_model = message.model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash-image")
            service = GeminiImageService(
                api_key=gemini_api_key,
                base_url=os.getenv("GEMINI_BASE_URL", "https://yunwu.ai"),
                model=gemini_model,
                auth_mode=os.getenv("GEMINI_AUTH_MODE")
            )
            print(f"[DEBUG] Created Gemini service with model: {gemini_model}")
        elif service_key == "doubao-image":
            doubao_api_key = os.getenv("DOUBAO_API_KEY")
            # print(f"[DEBUG] Using DOUBAO_API_KEY for this request: {doubao_api_key}")
            doubao_model = message.model or os.getenv("DOUBAO_MODEL", "doubao-seedream-4-0-250828")
            service = DoubaoImageService(
                api_key=doubao_api_key,
                base_url=os.getenv("DOUBAO_BASE_URL", "https://yunwu.ai"),
                model=doubao_model
            )
            print(f"[DEBUG] Created Doubao service with model: {doubao_model}")
        else:
            service = SERVICES.get(service_key)
            
        if not service:
            raise HTTPException(
                status_code=400,
                detail=f"Service '{service_key}' not found"
            )
        
        # Prepare kwargs based on service
        kwargs = {}
        if service_key == "gemini-image":
            kwargs = {
                "aspect_ratio": message.aspect_ratio,
                "image_size": message.image_size,
                "reference_image": message.reference_image
            }
        elif service_key == "doubao-image":
            kwargs = {
                "aspect_ratio": message.aspect_ratio,
                "image_size": message.image_size,
                "reference_image": message.reference_image
            }
        
        # Generate image
        print(f"[DEBUG] Calling generate_image with kwargs: {kwargs}")
        result = await service.generate_image(prompt=message.message, **kwargs)
        
        print(f"[DEBUG] Result success: {result.get('success')}")
        if not result.get('success'):
            print(f"[DEBUG] Error message: {result.get('message')}")
        
        if result["success"]:
            return {
                "success": True,
                "message": result.get("message", "图片生成成功"),
                "image_url": result.get("image_url"),
                "image_data": result.get("image_data"),
                "metadata": result.get("metadata", {})
            }
        else:
            return {
                "success": False,
                "message": result.get("message", "Image generation failed")
            }
            
    except Exception as e:
        print(f"[ERROR] Exception in chat endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def generate_image(request: ImageGenerationRequest):
    """
    Generate image with specific parameters
    """
    try:
        service_key = request.service
        if service_key == "gemini-image":
            service = GeminiImageService(
                api_key=os.getenv("GEMINI_API_KEY"),
                base_url=os.getenv("GEMINI_BASE_URL", "https://yunwu.ai"),
                model=request.model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash-image"),
                auth_mode=os.getenv("GEMINI_AUTH_MODE")
            )
        elif service_key == "doubao-image":
            service = DoubaoImageService(
                api_key=os.getenv("DOUBAO_API_KEY"),
                base_url=os.getenv("DOUBAO_BASE_URL", "https://yunwu.ai"),
                model=request.model or os.getenv("DOUBAO_MODEL", "doubao-seedream-4-0-250828")
            )
        else:
            service = SERVICES.get(service_key)

        if not service:
            raise HTTPException(
                status_code=400,
                detail=f"Service '{service_key}' not found"
            )
        
        # Prepare kwargs based on service
        kwargs = {}
        if service_key == "dalle":
            kwargs = {
                "size": f"{request.width}x{request.height}",
                "quality": request.quality
            }
        elif service_key == "stable-diffusion":
            kwargs = {
                "width": request.width,
                "height": request.height
            }
        elif service_key == "gemini-image":
            kwargs = {
                "aspect_ratio": request.aspect_ratio,
                "image_size": request.image_size,
                "reference_image": request.reference_image
            }
        elif service_key == "doubao-image":
            kwargs = {
                "aspect_ratio": request.aspect_ratio,
                "image_size": request.image_size,
                "reference_image": request.reference_image
            }
        
        result = await service.generate_image(prompt=request.prompt, **kwargs)
        
        if result["success"]:
            return {
                "success": True,
                "image_url": result.get("image_url"),
                "image_data": result.get("image_data"),
                "metadata": result.get("metadata", {}),
                "service": request.service
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Image generation failed")
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """
    Handle image uploads (for future image-to-image features)
    """
    try:
        # Read and validate image
        contents = await file.read()
        image = Image.open(BytesIO(contents))
        
        # Convert to base64 for storage/processing
        buffered = BytesIO()
        image.save(buffered, format=image.format or "PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return {
            "success": True,
            "message": "Image uploaded successfully",
            "filename": file.filename,
            "size": len(contents),
            "format": image.format,
            "dimensions": image.size,
            "image_data": img_str
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image file: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "True").lower() == "true"
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug
    )
