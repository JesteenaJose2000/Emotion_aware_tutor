from fastapi import APIRouter, File, UploadFile, HTTPException, status
import sys
from pathlib import Path

# Import FER service - handle path issues
try:
    from ...services.fer import infer_fer
except ImportError:
    # If relative import fails, add backend directory to path
    backend_dir = Path(__file__).resolve().parent.parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    from services.fer import infer_fer

router = APIRouter()


@router.post("/fer")
async def fer_endpoint(file: UploadFile = File(...)):
    """Facial Emotion Recognition endpoint - processes image and returns emotion probabilities."""
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file upload")
    
    # Validate content type
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Expected image file, got {content_type}"
        )
    
    try:
        image_bytes = await file.read()
        
        # Basic validation: check if file is not empty
        if len(image_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image file"
            )
        
        result = infer_fer(image_bytes)
        return result
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc











