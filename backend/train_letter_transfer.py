import json
import os

import numpy as np
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator


IMG_SIZE = (224, 224)
BATCH_SIZE = 16
SEED = 42
DATA_DIR = "data"
MODEL_PATH = "dyslexiscan_letter_mobilenet.keras"


def _preprocess(img):
    img = img.astype(np.float32)
    if float(np.mean(img)) > 127.0:
        img = 255.0 - img
    return preprocess_input(img)


train_datagen = ImageDataGenerator(
    preprocessing_function=_preprocess,
    validation_split=0.2,
    rotation_range=12,
    width_shift_range=0.10,
    height_shift_range=0.10,
    shear_range=0.08,
    zoom_range=0.12,
    brightness_range=(0.80, 1.20),
    fill_mode="nearest",
)

val_datagen = ImageDataGenerator(
    preprocessing_function=_preprocess,
    validation_split=0.2,
)

train_generator = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode="binary",
    subset="training",
    shuffle=True,
    seed=SEED,
)

validation_generator = val_datagen.flow_from_directory(
    DATA_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode="binary",
    subset="validation",
    shuffle=False,
    seed=SEED,
)

print("------------------------------------------------")
print(f"CLASS MAPPING: {train_generator.class_indices}")
print("------------------------------------------------")

counts = np.bincount(train_generator.classes)
total = float(np.sum(counts))
class_weight = {
    0: (total / 2.0) / max(1.0, float(counts[0])),
    1: (total / 2.0) / max(1.0, float(counts[1])),
}

base_model = MobileNetV2(weights="imagenet", include_top=False, input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3))
base_model.trainable = False

x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(128, activation="relu")(x)
x = Dropout(0.4)(x)
pred = Dense(1, activation="sigmoid")(x)

model = Model(inputs=base_model.input, outputs=pred)
model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4), loss="binary_crossentropy", metrics=["accuracy"])

callbacks = [
    tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=4, restore_best_weights=True),
    tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-6),
]

print("Starting Transfer Learning (MobileNetV2) for letter risk...")
model.fit(
    train_generator,
    epochs=15,
    validation_data=validation_generator,
    class_weight=class_weight,
    callbacks=callbacks,
)

base_model.trainable = True
for layer in base_model.layers:
    if isinstance(layer, tf.keras.layers.BatchNormalization):
        layer.trainable = False
for layer in base_model.layers[:-30]:
    layer.trainable = False

model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5), loss="binary_crossentropy", metrics=["accuracy"])
print("Fine-tuning last layers...")
model.fit(
    train_generator,
    epochs=10,
    validation_data=validation_generator,
    class_weight=class_weight,
    callbacks=callbacks,
)

print("\nValidation threshold sweep (treating dyslexic as positive class)...")
validation_generator.reset()

class_indices = train_generator.class_indices
normal_idx = class_indices.get("normal")
dys_idx = class_indices.get("dyslexic")

y_true = validation_generator.classes.astype(np.int32)
raw = model.predict(validation_generator).ravel().astype(np.float32)
raw = np.clip(raw, 0.0, 1.0)

if normal_idx == 1:
    prob_normal = raw
    class1_meaning = "normal"
elif normal_idx == 0:
    prob_normal = 1.0 - raw
    class1_meaning = "at_risk"
else:
    prob_normal = raw
    class1_meaning = "normal"

y_risk = 1.0 - prob_normal
if dys_idx in (0, 1):
    y_true_dys = (y_true == int(dys_idx)).astype(np.int32)
else:
    y_true_dys = (y_true == 0).astype(np.int32)


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


thresholds = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.60, 0.70]
best = None
for th in thresholds:
    tp, fp, fn, tn, precision, recall, f1 = _metrics_at_threshold(th)
    print(
        f"thr={th:.2f}  TP={tp:3d} FP={fp:3d} FN={fn:3d} TN={tn:3d}  "
        f"precision={precision:.2f} recall={recall:.2f} f1={f1:.2f}"
    )
    if best is None or f1 > best["f1"]:
        best = {"th": th, "precision": precision, "recall": recall, "f1": f1}

print(
    f"Recommended threshold (best F1 on val): {best['th']:.2f} "
    f"(precision={best['precision']:.2f}, recall={best['recall']:.2f}, f1={best['f1']:.2f})\n"
)

model.save(MODEL_PATH)
meta_path = os.path.splitext(MODEL_PATH)[0] + "_meta.json"
with open(meta_path, "w", encoding="utf-8") as f:
    json.dump(
        {
            "class_indices": class_indices,
            "class1_meaning": class1_meaning,
            "recommended_risk_threshold": float(best["th"]),
        },
        f,
        indent=2,
    )

print(f"SUCCESS! Model saved as '{MODEL_PATH}'")
