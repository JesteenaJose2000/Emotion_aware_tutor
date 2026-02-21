import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.preprocessing import LabelEncoder
import numpy as np
import json
import os

# Optional (only if installed)
try:
    from livelossplot import PlotLossesKerasTF
    LIVELosses = True
except ImportError:
    LIVELosses = False

# Set dataset paths
train_dir = "fer2013/train"
test_dir = "fer2013/test"

# Custom label mapping: folders should match these names
emotion_map = {
    "angry": "frustrated",
    "disgust": "frustrated",
    "fear": "frustrated",
    "happy": "positive",
    "sad": "frustrated",
    "surprise": "positive",
    "neutral": "neutral"
}

# Advanced data augmentation for training; light augmentation for validation
train_gen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True
)
test_gen = ImageDataGenerator(rescale=1./255)

# Data loading (using grayscale 48x48 as in FER2013)
train_data = train_gen.flow_from_directory(
    train_dir,
    target_size=(48, 48),
    color_mode='grayscale',
    class_mode='sparse',
    batch_size=64,
    shuffle=True
)
test_data = test_gen.flow_from_directory(
    test_dir,
    target_size=(48, 48),
    color_mode='grayscale',
    class_mode='sparse',
    batch_size=64,
    shuffle=False
)

# Collect class labels & custom labels for mapping
dataset_labels = list(train_data.class_indices.keys())
##custom_labels = [emotion_map[label.lower()] for label in dataset_labels]
filtered_labels = [label for label in dataset_labels if label.lower() in emotion_map]
custom_labels = [emotion_map[label.lower()] for label in filtered_labels]
le = LabelEncoder()
le.fit(custom_labels)

# Helper: Map base emotion indices to custom label indices
def original_to_custom_label_idx(original_indices):
    original_names = [dataset_labels[int(idx)] for idx in original_indices]
    cluster_names = [emotion_map[name.lower()] for name in original_names]
    return le.transform(cluster_names)

# Build a deeper and regularized CNN model to boost accuracy

model = tf.keras.Sequential([
    tf.keras.layers.Conv2D(64, (3,3), activation='relu', padding='same', input_shape=(48,48,1)),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2D(64, (3,3), activation='relu', padding='same'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.MaxPooling2D(2,2),
    tf.keras.layers.Dropout(0.25),

    tf.keras.layers.Conv2D(128, (3,3), activation='relu', padding='same'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2D(128, (3,3), activation='relu', padding='same'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.MaxPooling2D(2,2),
    tf.keras.layers.Dropout(0.3),

    tf.keras.layers.Conv2D(256, (3,3), activation='relu', padding='same'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.MaxPooling2D(2,2),
    tf.keras.layers.Dropout(0.4),

    tf.keras.layers.GlobalAveragePooling2D(),
    tf.keras.layers.Dense(128, activation='relu'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dropout(0.4),
    tf.keras.layers.Dense(len(dataset_labels), activation='softmax')
])

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)


# Callbacks for better training
callbacks = [
    tf.keras.callbacks.ModelCheckpoint('best_emotion_model.keras', save_best_only=True, monitor='val_loss'),
    tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, verbose=1),
    tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
]
if LIVELosses:
    callbacks.append(PlotLossesKerasTF())

# Main training loop
history = model.fit(
    train_data,
    validation_data=test_data,
    epochs=100,
    callbacks=callbacks
)

