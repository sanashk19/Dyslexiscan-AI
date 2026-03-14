import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model

# 1. Setup Paths
BASE_DIR = 'datasets'
MODEL_SAVE_PATH = os.path.join('models', 'page_model.h5')

IMG_SIZE = (224, 224)
BATCH_SIZE = 16
SEED = 42


# 2. Data Augmentation + MobileNetV2 preprocessing
# Important: we use MobileNetV2's preprocess_input instead of rescale=1./255
train_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    validation_split=0.2,
    rotation_range=10,
    width_shift_range=0.10,
    height_shift_range=0.10,
    zoom_range=0.10,
    brightness_range=(0.85, 1.15),
    fill_mode='nearest'
)

val_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    validation_split=0.2
)

train_generator = train_datagen.flow_from_directory(
    BASE_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='binary',
    subset='training',
    shuffle=True,
    seed=SEED
)

validation_generator = val_datagen.flow_from_directory(
    BASE_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='binary',
    subset='validation',
    shuffle=False,
    seed=SEED
)

print("------------------------------------------------")
print(f"CLASS MAPPING: {train_generator.class_indices}")
print("------------------------------------------------")


# 3. Build the Transfer Learning Model (MobileNetV2)
base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3))
base_model.trainable = False

x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(128, activation='relu')(x)
x = Dropout(0.4)(x)
predictions = Dense(1, activation='sigmoid')(x)

model = Model(inputs=base_model.input, outputs=predictions)

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
    loss='binary_crossentropy',
    metrics=['accuracy']
)


# 4. Train (frozen base)
print("Starting Transfer Learning (MobileNetV2)...")
callbacks = [
    tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=4, restore_best_weights=True),
    tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=2, min_lr=1e-6),
]

model.fit(
    train_generator,
    epochs=15,
    validation_data=validation_generator,
    callbacks=callbacks
)


# 5. Light fine-tuning (unfreeze last layers)
base_model.trainable = True

# Keep BatchNorm frozen for stability
for layer in base_model.layers:
    if isinstance(layer, tf.keras.layers.BatchNormalization):
        layer.trainable = False

# Unfreeze only last ~30 layers
for layer in base_model.layers[:-30]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
    loss='binary_crossentropy',
    metrics=['accuracy']
)

print("Fine-tuning last layers...")
model.fit(
    train_generator,
    epochs=10,
    validation_data=validation_generator,
    callbacks=callbacks
)


# 6. Validation threshold sweep (assumes dyslexic=0, non_dyslexic=1)
print("\nValidation threshold sweep (treating dyslexic as positive class)...")
validation_generator.reset()

# Model outputs P(class=1). With mapping {'dyslexic': 0, 'non_dyslexic': 1}, dyslexia risk = 1 - P(non_dyslexic)
# If your folders are named differently, adjust backend PAGE_MODEL_CLASS1 env var.

y_true = validation_generator.classes.astype(np.int32)
raw = model.predict(validation_generator).ravel().astype(np.float32)
raw = np.clip(raw, 0.0, 1.0)

# dyslexic is class 0
y_true_dys = (y_true == 0).astype(np.int32)
y_risk = 1.0 - raw


def _metrics_at_threshold(th):
    y_pred_dys = (y_risk >= th).astype(np.int32)
    tp = int(np.sum((y_pred_dys == 1) & (y_true_dys == 1)))
    fp = int(np.sum((y_pred_dys == 1) & (y_true_dys == 0)))
    fn = int(np.sum((y_pred_dys == 0) & (y_true_dys == 1)))
    tn = int(np.sum((y_pred_dys == 0) & (y_true_dys == 0)))
    precision = tp / max(1, (tp + fp))
    recall = tp / max(1, (tp + fn))
    f1 = (2 * precision * recall) / max(1e-9, (precision + recall))
    return tp, fp, fn, tn, precision, recall, f1


thresholds = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.60]
best = None
for th in thresholds:
    tp, fp, fn, tn, precision, recall, f1 = _metrics_at_threshold(th)
    print(
        f"thr={th:.2f}  TP={tp:3d} FP={fp:3d} FN={fn:3d} TN={tn:3d}  "
        f"precision={precision:.2f} recall={recall:.2f} f1={f1:.2f}"
    )
    if best is None or f1 > best['f1']:
        best = {'th': th, 'precision': precision, 'recall': recall, 'f1': f1}

print(
    f"Recommended threshold (best F1 on val): {best['th']:.2f} "
    f"(precision={best['precision']:.2f}, recall={best['recall']:.2f}, f1={best['f1']:.2f})\n"
)


# 7. Save
if not os.path.exists('models'):
    os.makedirs('models')

model.save(MODEL_SAVE_PATH)
print(f"Success! Transfer Model saved to {MODEL_SAVE_PATH}")
