from pathlib import Path
import os


# Base directory for the backend package
BASE_DIR: Path = Path(__file__).resolve().parent

# Paths
MODELS_DIR: Path = BASE_DIR / "models"
STORAGE_DIR: Path = BASE_DIR / "storage"

# SER assets
SER_CLASSIFIER_PATH: Path = MODELS_DIR / "ser_clf.pkl"

# Audio constants
SER_SAMPLE_RATE: int = 16000
SER_TARGET_MONO: bool = True

# openSMILE configuration (allow overriding via env for experimentation)
SMILE_FEATURE_SET: str = os.getenv("SMILE_FEATURE_SET", "ComParE_2016")
SMILE_FEATURE_LEVEL: str = os.getenv("SMILE_FEATURE_LEVEL", "Functionals")

# Fallback behavior (for demos): if no classifier, return neutral instead of 503
SER_ALLOW_FALLBACK: bool = os.getenv("SER_ALLOW_FALLBACK", "1") in {"1", "true", "True"}

# FER assets
FER_MODEL_PATH: Path = MODELS_DIR / "best_emotion_model_custom.keras"

# FER fallback behavior (for demos): if no model, return neutral instead of 503
FER_ALLOW_FALLBACK: bool = os.getenv("FER_ALLOW_FALLBACK", "1") in {"1", "true", "True"}


