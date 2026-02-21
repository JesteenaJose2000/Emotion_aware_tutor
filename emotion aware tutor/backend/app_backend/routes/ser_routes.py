from fastapi import APIRouter, File, UploadFile, HTTPException, status
import sys
from pathlib import Path

# Import SER service - handle path issues
try:
    from ...services.ser import infer_ser
except ImportError:
    # If relative import fails, add backend directory to path
    backend_dir = Path(__file__).resolve().parent.parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    from services.ser import infer_ser

router = APIRouter()


@router.post("/ser")
async def ser_endpoint(file: UploadFile = File(...)):
    """Speech Emotion Recognition endpoint - processes audio and returns emotion probabilities."""
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file upload")
    try:
        wav_bytes = await file.read()
        result = infer_ser(wav_bytes)
        return result
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc





















