import io
from typing import Dict, Tuple
import sys
from pathlib import Path

import numpy as np
from fastapi import HTTPException, status
import joblib
import soundfile as sf
import librosa

try:  # optional dependency; only needed for Booster compatibility
    import xgboost as xgb
except Exception:  # pragma: no cover
    xgb = None


class XGBSERWrapper:
    """Lightweight wrapper to keep Booster + predict interface pickle-friendly."""

    def __init__(self, booster, num_classes: int | None = None):
        self.booster = booster
        self.num_classes = num_classes

    def predict(self, X):
        if xgb is None:
            raise RuntimeError("xgboost is required to use XGBSERWrapper predictions.")
        dmatrix = xgb.DMatrix(X)
        probs = self.booster.predict(dmatrix)
        if (
            probs is not None
            and self.num_classes
            and probs.ndim == 1
            and probs.size == self.num_classes
        ):
            probs = probs.reshape(1, self.num_classes)
        return probs


# Some training pipelines pickle this wrapper from a __main__ module name.
# Register it on sys.modules["__main__"] so that joblib can resolve it.
main_module = sys.modules.setdefault("__main__", type(sys)("__main__"))
setattr(main_module, "XGBSERWrapper", XGBSERWrapper)

# Import settings - handle both relative and absolute imports
try:
    from .. import settings
except ImportError:
    # If relative import fails, add parent directory to path and import directly
    backend_dir = Path(__file__).resolve().parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    import settings


# Initialize openSMILE once
def _resolve_smile_enum(enum_cls, configured_value: str, enum_label: str):
    """Map config string (e.g. 'ComParE_2016') to the openSMILE enum."""
    if isinstance(configured_value, enum_cls):
        return configured_value
    if isinstance(configured_value, str):
        try:
            return getattr(enum_cls, configured_value)
        except AttributeError as exc:
            members = getattr(enum_cls, "__members__", {})
            valid = ", ".join(members.keys()) if members else "unknown"
            raise RuntimeError(
                f"Invalid {enum_label} '{configured_value}'. Valid options: {valid}"
            ) from exc
    raise RuntimeError(f"{enum_label} must be provided as a string or {enum_cls.__name__}.")


try:
    import opensmile

    feature_set = _resolve_smile_enum(
        opensmile.FeatureSet, settings.SMILE_FEATURE_SET, "openSMILE feature set"
    )
    feature_level = _resolve_smile_enum(
        opensmile.FeatureLevel, settings.SMILE_FEATURE_LEVEL, "openSMILE feature level"
    )
    SMILE = opensmile.Smile(feature_set=feature_set, feature_level=feature_level)
except Exception as exc:  # pragma: no cover
    SMILE = None


def _pick_classifier_from_bundle(bundle: dict):
    """Best-effort extraction of classifier from a saved bundle."""
    candidate_keys = ("model", "clf", "classifier")
    for key in candidate_keys:
        if key in bundle and bundle[key] is not None:
            return bundle[key]
    for value in bundle.values():
        if hasattr(value, "predict_proba") or hasattr(value, "predict"):
            return value
    return None


# Load classifier and scaler once
# Expected emotion order: [angry, disgust, fear, happy, sad, surprise, neutral]
# This matches training order: EMO7 = ["angry","disgust","fear","happy","sad","surprise","neutral"]
EMO7_LABELS = [
    "angry",
    "disgust",
    "fear",
    "happy",
    "sad",
    "surprise",
    "neutral",
]
_clf_load_error: str | None = None
SCALER = None
CLF = None
EMO_LABELS = None
try:
    if settings.SER_CLASSIFIER_PATH.exists():
        loaded = joblib.load(settings.SER_CLASSIFIER_PATH)
        # Handle case where pickle contains a dictionary with the classifier
        if isinstance(loaded, dict):
            CLF = _pick_classifier_from_bundle(loaded)
            if CLF is None:
                raise ValueError(
                    f"Dictionary loaded but no classifier found. Keys: {list(loaded.keys())}"
                )

            # Extract scaler if present (may be None)
            SCALER = loaded.get("scaler")

            # Extract emotion labels if present (for validation)
            EMO_LABELS = (
                loaded.get("labels")
                or loaded.get("emolabels")
                or loaded.get("classes")
            )
            if EMO_LABELS is not None:
                expected = EMO7_LABELS
                if list(EMO_LABELS) != expected:
                    print(
                        "Warning: Emotion labels don't match expected order. "
                        f"Got: {EMO_LABELS}, Expected: {expected}"
                    )
        else:
            # Direct classifier object
            CLF = loaded
        
        # Validate that CLF is actually a classifier
        if CLF is not None and not (hasattr(CLF, 'predict_proba') or hasattr(CLF, 'predict') or hasattr(CLF, 'decision_function')):
            raise ValueError(f"Loaded object is not a valid classifier. Type: {type(CLF)}, Attributes: {dir(CLF)[:10]}")
    else:
        CLF = None
        _clf_load_error = "Classifier file not found"
except Exception as exc:  # pragma: no cover
    CLF = None
    SCALER = None
    EMO_LABELS = None
    _clf_load_error = f"Failed to load classifier: {exc}"


def decode_audio(wav_bytes: bytes, target_sr: int = settings.SER_SAMPLE_RATE) -> Tuple[np.ndarray, int]:
    """Decode WAV/AIFF/FLAC bytes → mono float32 at target_sr.

    Raises ValueError for invalid or empty audio.
    """
    if not wav_bytes:
        raise ValueError("Empty audio payload")

    try:
        with sf.SoundFile(io.BytesIO(wav_bytes)) as f:
            audio = f.read(dtype="float32")
            sr = f.samplerate
    except Exception as exc:
        raise ValueError(f"Unsupported or corrupt audio: {exc}") from exc

    if audio.size == 0:
        raise ValueError("No audio samples decoded")

    # Ensure mono
    if audio.ndim == 2:
        audio = np.mean(audio, axis=1)

    # Resample
    if sr != target_sr:
        try:
            audio = librosa.resample(y=audio, orig_sr=sr, target_sr=target_sr)
            sr = target_sr
        except Exception as exc:
            raise ValueError(f"Resampling failed: {exc}") from exc

    # Normalize to float32
    if audio.dtype != np.float32:
        audio = audio.astype(np.float32, copy=False)

    return audio, sr


def simple_vad(
    audio: np.ndarray,
    sr: int = settings.SER_SAMPLE_RATE,
    frame: float = 0.03,
    hop: float = 0.015,
    th: float = 0.0005,  # Lowered threshold from 0.0015 to 0.0005 for better sensitivity
) -> float:
    """Compute simple energy-based VAD fraction in [0, 1]."""
    if audio.size == 0:
        return 0.0

    frame_length = max(1, int(frame * sr))
    hop_length = max(1, int(hop * sr))

    if audio.size < frame_length:
        energy = np.mean(audio**2)
        return float(energy > th)

    frames = librosa.util.frame(audio, frame_length=frame_length, hop_length=hop_length)
    energies = np.mean(frames**2, axis=0)
    voiced = np.count_nonzero(energies > th)
    return float(voiced / len(energies))


def emo7_to_emo3(probs7: np.ndarray) -> Dict[str, float]:
    """Map 7-way distribution → {pos, neu, fru}.

    Expected 7 classes order: [angry, disgust, fear, happy, sad, surprise, neutral]
    This matches training order: EMO7 = ["angry","disgust","fear","happy","sad","surprise","neutral"]

    Mapping (using averages to avoid category-count bias):
    - pos = (happy + surprise) / 2.0
    - fru = (angry + disgust + fear + sad) / 4.0
    - neu = neutral

    Then normalized: pos, neu, fru = pos/s, neu/s, fru/s where s = pos + neu + fru
    """
    if probs7.shape[-1] != 7:
        raise ValueError("Classifier must output 7 probabilities")

    # Unpack in order: [angry, disgust, fear, happy, sad, surprise, neutral]
    angry, disgust, fear, happy, sad, surprise, neutral = probs7

    pos = float((happy + surprise) / 2.0)
    neu = float(neutral)
    fru = float((angry + disgust + fear + sad) / 4.0)

    # Re-normalize to sum 1 (robustness)
    s = pos + neu + fru
    if s <= 0:
        return {"pos": 0.0, "neu": 1.0, "fru": 0.0}
    return {"pos": pos / s, "neu": neu / s, "fru": fru / s}


def _ensure_ready():
    if SMILE is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="openSMILE not available",
        )
    if CLF is None and not settings.SER_ALLOW_FALLBACK:
        msg = "SER classifier not found"
        if _clf_load_error:
            msg = f"SER classifier not found: {_clf_load_error}"
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=msg)


def infer_ser(wav_bytes: bytes) -> Dict[str, float]:
    """Full SER pipeline: decode → VAD → openSMILE → classifier → map to pos/neu/fru."""
    _ensure_ready()

    audio, sr = decode_audio(wav_bytes, target_sr=settings.SER_SAMPLE_RATE)

    # Basic sanity check for duration
    if audio.size < int(0.1 * sr):
        raise ValueError("Audio too short")

    vad_frac = simple_vad(audio, sr=sr)

    # Extract features
    try:
        feats_df = SMILE.process_signal(audio, sr)
    except Exception as exc:
        raise ValueError(f"Feature extraction failed: {exc}") from exc

    if feats_df is None or feats_df.empty:
        raise ValueError("Feature extraction returned empty output")

    X = feats_df.values.astype(np.float32)
    
    # Apply scaler if available
    if SCALER is not None:
        X = SCALER.transform(X)

    # Predict probabilities
    if CLF is None and settings.SER_ALLOW_FALLBACK:
        warn = "SER fallback engaged: classifier not loaded"
        if _clf_load_error:
            warn += f" ({_clf_load_error})"
        print(f"[WARN] {warn}")
        # Neutral fallback for demos when model is missing
        probs = np.array(
            [0, 0.25, 0, 0, 0.25, 0, 0.5], dtype=np.float32
        )  # Roughly maps → pos≈0.4, neu≈0.6, fru≈0
    else:
        try:
            probs = None
            if hasattr(CLF, "predict_proba"):
                probs = CLF.predict_proba(X)[0]
            elif hasattr(CLF, "decision_function"):
                scores = CLF.decision_function(X)[0]
                e = np.exp(scores - np.max(scores))
                probs = e / np.sum(e)
            elif hasattr(CLF, "predict"):
                preds = CLF.predict(X)
                preds = np.asarray(preds)
                if preds.ndim == 2 and preds.shape[1] == 7:
                    probs = preds[0]
                else:
                    raise ValueError(
                        "Classifier predict() must return class probabilities of shape (n_samples, 7)"
                    )
            elif xgb is not None and isinstance(CLF, xgb.Booster):
                dmatrix = xgb.DMatrix(X)
                probs = CLF.predict(dmatrix)[0]
            else:
                raise ValueError(
                    f"Unsupported classifier type {type(CLF)}. Needs predict_proba/decision_function/predict."
                )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Classifier error: {exc}",
            )

    probs = np.array(probs, dtype=np.float32)
    
    # Print 7-class emotion probabilities for debugging/model accuracy checking
    emotion_labels = EMO7_LABELS
    print("\n[SER Model Output] 7-Class Emotion Probabilities:")
    for i, (label, prob) in enumerate(zip(emotion_labels, probs)):
        print(f"  {label:8s}: {prob:.4f} ({prob*100:.2f}%)")
    print(f"  Sum: {np.sum(probs):.4f}")
    print(f"  VAD: {vad_frac:.4f}\n")
    
    out = emo7_to_emo3(probs)
    out["vad"] = float(np.clip(vad_frac, 0.0, 1.0))
    return out


