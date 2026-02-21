"""
Convert Keras .keras model to TensorFlow.js format for use in the frontend.

Usage:
    python convert_keras_to_tfjs.py --input best_emotion_model_custom.keras --output ../frontend/public/models/fer-custom

Requirements:
    pip install tensorflowjs
"""

import argparse
import sys
from pathlib import Path

try:
    import tensorflow as tf
    import tensorflowjs as tfjs
except ImportError:
    print("ERROR: Required packages not installed.")
    print("Please install: pip install tensorflow tensorflowjs")
    sys.exit(1)


def convert_keras_to_tfjs(input_path: str, output_dir: str):
    """
    Convert a Keras .keras model to TensorFlow.js format.
    
    Args:
        input_path: Path to the .keras model file
        output_dir: Directory where TensorFlow.js model will be saved
    """
    input_file = Path(input_path)
    output_path = Path(output_dir)
    
    # Validate input file
    if not input_file.exists():
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)
    
    if not input_file.suffix == '.keras':
        print(f"WARNING: Input file doesn't have .keras extension: {input_path}")
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    print(f"Loading Keras model from: {input_path}")
    try:
        # Load the Keras model
        model = tf.keras.models.load_model(input_path)
        
        # Print model summary
        print("\nModel Summary:")
        model.summary()
        
        # Print input/output shapes
        print(f"\nInput shape: {model.input_shape}")
        print(f"Output shape: {model.output_shape}")
        
        # Verify output classes
        if len(model.output_shape) == 2 and model.output_shape[1] == 7:
            print("✓ Model has 7 output classes (matches expected emotion classes)")
        else:
            print(f"⚠ WARNING: Model has {model.output_shape[1] if len(model.output_shape) == 2 else 'unknown'} output classes, expected 7")
        
        print(f"\nConverting to TensorFlow.js format...")
        print(f"Output directory: {output_path}")
        
        # Convert to TensorFlow.js
        tfjs.converters.save_keras_model(model, str(output_path))
        
        print(f"\n✓ Conversion successful!")
        print(f"Model files saved to: {output_path}")
        print(f"\nNext steps:")
        print(f"1. Verify that model.json exists in: {output_path / 'model.json'}")
        print(f"2. Update frontend/src/hooks/useWebcamFer.ts to use the new model path")
        print(f"3. The model expects input shape: {model.input_shape}")
        print(f"   (48, 48, 1) grayscale images, rescaled by 1/255")
        
    except Exception as e:
        print(f"ERROR during conversion: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert Keras .keras model to TensorFlow.js format"
    )
    parser.add_argument(
        "--input",
        "-i",
        required=True,
        help="Path to input .keras model file"
    )
    parser.add_argument(
        "--output",
        "-o",
        default="../frontend/public/models/fer-custom",
        help="Output directory for TensorFlow.js model (default: ../frontend/public/models/fer-custom)"
    )
    
    args = parser.parse_args()
    convert_keras_to_tfjs(args.input, args.output)











