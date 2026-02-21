"""
Facial Emotion Recognition (FER) service using TensorFlow/Keras models.

Similar to SER service, but processes images instead of audio.
"""

from typing import Dict
from pathlib import Path
import sys

import numpy as np
from fastapi import HTTPException, status
import tensorflow as tf
from PIL import Image
import io

# Import settings - handle both relative and absolute imports
try:
    from .. import settings
except ImportError:
    # If relative import fails, add parent directory to path and import directly
    backend_dir = Path(__file__).resolve().parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    import settings

# Global model cache
FER_MODEL = None
_fer_load_error: str | None = None

# Expected emotion order: [angry, disgust, fear, happy, sad, surprise, neutral]
EMOTION_LABELS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]


def _load_fer_model():
    """Load the FER model once at startup."""
    global FER_MODEL, _fer_load_error
    
    if FER_MODEL is not None:
        return  # Already loaded
    
    if settings.FER_MODEL_PATH.exists():
        try:
            print(f"Loading FER model from: {settings.FER_MODEL_PATH}")
            FER_MODEL = tf.keras.models.load_model(str(settings.FER_MODEL_PATH))
            
            # Verify model input/output shapes
            input_shape = FER_MODEL.input_shape
            output_shape = FER_MODEL.output_shape
            
            print(f"FER model loaded successfully")
            print(f"  Input shape: {input_shape}")
            print(f"  Output shape: {output_shape}")
            
            # Validate input shape (should be (None, 48, 48, 1) for grayscale)
            if len(input_shape) == 4 and input_shape[1:3] == (48, 48):
                print(f"  ✓ Input shape matches expected (48, 48, 1)")
            else:
                print(f"  ⚠ WARNING: Input shape {input_shape} doesn't match expected (None, 48, 48, 1)")
            
            # Validate output shape (should be 7 classes)
            if len(output_shape) == 2 and output_shape[1] == 7:
                print(f"  ✓ Output shape matches expected 7 emotion classes")
            else:
                print(f"  ⚠ WARNING: Output shape {output_shape} doesn't match expected 7 classes")
                
        except Exception as exc:
            FER_MODEL = None
            _fer_load_error = f"Failed to load FER model: {exc}"
            print(f"ERROR: {_fer_load_error}")
    else:
        FER_MODEL = None
        _fer_load_error = f"FER model file not found at: {settings.FER_MODEL_PATH}"


def _ensure_ready():
    """Ensure the FER model is loaded and ready."""
    if FER_MODEL is None:
        _load_fer_model()
    
    if FER_MODEL is None:
        if settings.FER_ALLOW_FALLBACK:
            print(f"[WARN] FER fallback engaged: model not loaded")
            if _fer_load_error:
                print(f"[WARN] Error: {_fer_load_error}")
            return  # Allow fallback
        else:
            msg = "FER model not available"
            if _fer_load_error:
                msg += f": {_fer_load_error}"
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=msg)


def preprocess_image(image_bytes: bytes, target_size: tuple = (48, 48)) -> np.ndarray:
    """
    Preprocess image to match training pipeline.
    
    Steps:
    1. Load image from bytes
    2. Convert to grayscale
    3. Resize to target_size (48x48)
    4. Rescale by 1/255
    5. Add batch dimension
    
    Args:
        image_bytes: Raw image bytes (JPEG, PNG, etc.)
        target_size: Target image size (height, width)
    
    Returns:
        Preprocessed image array with shape (1, 48, 48, 1)
    """
    try:
        # Load image from bytes
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to grayscale (matching training color_mode='grayscale')
        if image.mode != 'L':
            image = image.convert('L')
        
        # Resize to target size (matching training target_size=(48, 48))
        image = image.resize(target_size, Image.Resampling.BILINEAR)
        
        # Convert to numpy array
        img_array = np.array(image, dtype=np.float32)
        
        # Rescale by 1/255 (matching training rescale=1./255)
        img_array = img_array / 255.0
        
        # Add channel dimension: (48, 48) -> (48, 48, 1)
        img_array = np.expand_dims(img_array, axis=-1)
        
        # Add batch dimension: (48, 48, 1) -> (1, 48, 48, 1)
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
        
    except Exception as e:
        raise ValueError(f"Image preprocessing failed: {e}") from e


def map_seven_to_fer(probs_7: np.ndarray) -> Dict[str, float]:
    """
    Map 7-class emotion probabilities to 3-class FER format.
    
    Order: [angry, disgust, fear, happy, sad, surprise, neutral]
    Mapping:
    - pos (positive): happy + surprise
    - neu (neutral): neutral
    - fru (frustrated): angry + disgust + fear + sad
    
    Args:
        probs_7: Array of 7 emotion probabilities
    
    Returns:
        Dictionary with pos, neu, fru probabilities (normalized)
    """
    if len(probs_7) != 7:
        raise ValueError(f"Expected 7 probabilities, got {len(probs_7)}")
    
    # Ensure probabilities are valid
    probs_7 = np.clip(probs_7, 0.0, 1.0)
    
    angry = probs_7[0]
    disgust = probs_7[1]
    fear = probs_7[2]
    happy = probs_7[3]
    sad = probs_7[4]
    surprise = probs_7[5]
    neutral = probs_7[6]
    
    pos = happy + surprise
    fru = angry + disgust + fear + sad
    neu = neutral
    
    # Normalize to sum to 1
    total = pos + neu + fru
    if total > 0:
        pos /= total
        neu /= total
        fru /= total
    else:
        # Fallback to uniform distribution
        pos = neu = fru = 1.0 / 3.0
    
    return {
        "pos": float(pos),
        "neu": float(neu),
        "fru": float(fru),
    }


def infer_fer(image_bytes: bytes) -> Dict[str, float]:
    """
    Full FER pipeline: preprocess image → model inference → map to pos/neu/fru.
    
    Args:
        image_bytes: Raw image bytes (JPEG, PNG, etc.)
    
    Returns:
        Dictionary with emotion probabilities: {"pos": float, "neu": float, "fru": float}
    """
    _ensure_ready()
    
    # Preprocess image
    preprocessed = preprocess_image(image_bytes, target_size=(48, 48))
    
    # Run inference
    if FER_MODEL is None and settings.FER_ALLOW_FALLBACK:
        # Fallback: return neutral emotion
        print("[WARN] FER model not available, using fallback (neutral)")
        return {"pos": 1.0 / 3.0, "neu": 1.0 / 3.0, "fru": 1.0 / 3.0}
    
    try:
        # Predict probabilities
        predictions = FER_MODEL.predict(preprocessed, verbose=0)
        
        # Get probabilities (model should output softmax probabilities)
        if predictions.ndim == 2:
            probs_7 = predictions[0]  # Get first (and only) batch item
        else:
            probs_7 = predictions
        
        # Ensure we have 7 probabilities
        if len(probs_7) != 7:
            raise ValueError(f"Model output has {len(probs_7)} classes, expected 7")
        
        # Print 7-class emotion probabilities for debugging
        # print("\n[FER Model Output] 7-Class Emotion Probabilities:")
        # for i, (label, prob) in enumerate(zip(EMOTION_LABELS, probs_7)):
        #     print(f"  {label}: {prob:.4f}")
        
        # Map to 3-class FER format
        fer_3 = map_seven_to_fer(probs_7)
        
        # print(f"[FER] Mapped to 3-class: pos={fer_3['pos']:.3f}, neu={fer_3['neu']:.3f}, fru={fer_3['fru']:.3f}")
        
        return fer_3
        
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"FER inference failed: {exc}",
        ) from exc


# Load model at module import time
_load_fer_model()




