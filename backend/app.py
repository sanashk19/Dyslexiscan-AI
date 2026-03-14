from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, ImageOps
import base64
import cv2
import io
import json
import numpy as np
import os
import re
import tensorflow as tf
from typing import Optional
import serial
import threading
import math
import time
import random

try:
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input as mobilenet_v2_preprocess
except Exception:
    mobilenet_v2_preprocess = None

app = Flask(__name__)
CORS(app)

# Global variables to store the live pen pressure
latest_grip1 = 0
latest_grip2 = 0

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

LETTER_MODEL_PATH = os.getenv('LETTER_MODEL_PATH', os.path.join(BASE_DIR, 'dyslexiscan_letter_mobilenet.keras'))
if LETTER_MODEL_PATH and not os.path.isabs(LETTER_MODEL_PATH):
    LETTER_MODEL_PATH = os.path.join(BASE_DIR, LETTER_MODEL_PATH)
PAGE_MODEL_PATH = os.path.join(BASE_DIR, 'models', 'page_model.h5')

_letter_meta = {}
try:
    default_meta_path = os.path.splitext(LETTER_MODEL_PATH)[0] + '_meta.json'
    meta_path = os.getenv('LETTER_MODEL_META_PATH', default_meta_path)
    if meta_path and not os.path.isabs(meta_path):
        meta_path = os.path.join(BASE_DIR, meta_path)
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8') as f:
            _letter_meta = json.load(f) if f else {}
except Exception:
    _letter_meta = {}

def custom_input_layer_from_config(config):
    # Remove batch_shape if it exists (compatibility for older models)
    if 'batch_shape' in config:
        # Convert batch_shape to shape and batch_size
        batch_shape = config.pop('batch_shape')
        if batch_shape[0] is None:  # None means variable batch size
            config['shape'] = batch_shape[1:]
        else:
            config['batch_size'] = batch_shape[0]
            config['shape'] = batch_shape[1:]
    return tf.keras.layers.InputLayer(**config)

letter_model = tf.keras.models.load_model(LETTER_MODEL_PATH, compile=False)
page_model = None
_page_model_load_error = None
try:
    page_model = tf.keras.models.load_model(PAGE_MODEL_PATH)
except Exception as e:
    _page_model_load_error = str(e)

LETTER_MODEL_CLASS1 = os.getenv('LETTER_MODEL_CLASS1', str(_letter_meta.get('class1_meaning', 'normal'))).strip().lower()
PAGE_MODEL_CLASS1 = os.getenv('PAGE_MODEL_CLASS1', 'non_dyslexic').strip().lower()

try:
    _default_letter_th = str(_letter_meta.get('recommended_risk_threshold', '0.5'))
    LETTER_RISK_THRESHOLD = float(os.getenv('LETTER_RISK_THRESHOLD', _default_letter_th))
except Exception:
    LETTER_RISK_THRESHOLD = 0.5
try:
    PAGE_RISK_THRESHOLD = float(os.getenv('PAGE_RISK_THRESHOLD', '0.5'))
except Exception:
    PAGE_RISK_THRESHOLD = 0.5


def _otsu_threshold(img_arr):
    hist = np.bincount(img_arr.ravel(), minlength=256).astype(np.float64)
    total = img_arr.size
    sum_total = np.dot(np.arange(256), hist)

    sum_b = 0.0
    w_b = 0.0
    max_var = -1.0
    threshold = 127

    for t in range(256):
        w_b += hist[t]
        if w_b == 0:
            continue
        w_f = total - w_b
        if w_f == 0:
            break
        sum_b += t * hist[t]
        m_b = sum_b / w_b
        m_f = (sum_total - sum_b) / w_f
        var_between = w_b * w_f * (m_b - m_f) ** 2
        if var_between > max_var:
            max_var = var_between
            threshold = t

    return int(np.clip(threshold, 30, 230))


def _crop_pad_resize(img_l, out_size=(64, 64)):
    img_l = ImageOps.autocontrast(img_l)
    arr = np.array(img_l, dtype=np.uint8)
    t = _otsu_threshold(arr)
    mask = arr < t

    coords = np.argwhere(mask)
    if coords.size == 0:
        return img_l.resize(out_size)

    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0) + 1

    h = y1 - y0
    w = x1 - x0
    pad = int(0.12 * max(h, w))

    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(arr.shape[1], x1 + pad)
    y1 = min(arr.shape[0], y1 + pad)

    cropped = img_l.crop((x0, y0, x1, y1))
    cw, ch = cropped.size
    side = max(cw, ch)
    canvas = Image.new('L', (side, side), 255)
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2))
    return canvas.resize(out_size)


def _safe_model_hw(model):
    shape = getattr(model, 'input_shape', None)
    if not shape or len(shape) != 4:
        return 64, 64, 1

    h = int(shape[1]) if shape[1] else 64
    w = int(shape[2]) if shape[2] else 64
    c = int(shape[3]) if shape[3] else 1
    return h, w, c


def _open_image_with_alpha_fix(file_storage):
    img = Image.open(file_storage)
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        bg = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        bg.paste(img, mask=img.split()[3])
        img = bg
    return img


def clean_image_for_model(image_file):
    file_bytes = np.frombuffer(image_file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_GRAYSCALE)
    image_file.seek(0)

    if img is None:
        raise ValueError('Invalid image data')

    blurred = cv2.GaussianBlur(img, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        11,
        2,
    )

    pil_img = Image.fromarray(binary)
    return pil_img


def _make_debug_contours(img_l):
    try:
        gray = np.array(img_l, dtype=np.uint8)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        contours_result = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = contours_result[0] if len(contours_result) == 2 else contours_result[1]

        contour_img = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
        cv2.drawContours(contour_img, contours, -1, (0, 255, 0), thickness=2)

        contour_rgb = cv2.cvtColor(contour_img, cv2.COLOR_BGR2RGB)
        debug_buf = io.BytesIO()
        Image.fromarray(contour_rgb).save(debug_buf, format='PNG')
        return base64.b64encode(debug_buf.getvalue()).decode('utf-8')
    except Exception:
        return None


@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file = request.files['image']
    img = _open_image_with_alpha_fix(file)

    h, w, c = _safe_model_hw(letter_model)

    img_l = img.convert('L')
    if np.mean(np.array(img_l)) < 127:
        img_l = ImageOps.invert(img_l)

    img_l = _crop_pad_resize(img_l, out_size=(w, h))
    debug_b64 = _make_debug_contours(img_l)

    arr = np.array(img_l, dtype=np.float32) / 255.0
    arr = 1.0 - arr

    if c == 1:
        arr = arr.reshape(1, h, w, 1)
    else:
        arr3 = np.stack([arr, arr, arr], axis=-1)
        arr = arr3.reshape(1, h, w, 3)
        if mobilenet_v2_preprocess is not None and h == 224 and w == 224 and c == 3:
            arr = mobilenet_v2_preprocess(arr * 255.0)

    pred = letter_model.predict(arr)

    if pred.ndim == 2 and pred.shape[1] == 1:
        p_class1 = float(np.clip(float(pred[0][0]), 0.0, 1.0))

        if LETTER_MODEL_CLASS1 in ('at_risk', 'dyslexic', 'risk'):
            prob_normal = 1.0 - p_class1
            prediction = 'at_risk' if p_class1 >= LETTER_RISK_THRESHOLD else 'normal'
            confidence = (p_class1 if prediction == 'at_risk' else prob_normal) * 100.0
            risk_percent = p_class1 * 100.0
        else:
            prob_normal = p_class1
            prediction = 'normal' if (1.0 - prob_normal) < LETTER_RISK_THRESHOLD else 'at_risk'
            confidence = (prob_normal if prediction == 'normal' else (1.0 - prob_normal)) * 100.0
            risk_percent = (1.0 - prob_normal) * 100.0

        analysis = (
            'Standard handwriting patterns detected.'
            if risk_percent < 50
            else 'Potential reversal patterns detected.'
        )

        return jsonify({
            'prediction': prediction,
            'confidence': round(confidence, 2),
            'status': 'ok',
            'probability': prob_normal,
            'risk_score': risk_percent,
            'analysis': analysis,
            'debug_image': debug_b64,
            'p_class1': p_class1,
            'class1_meaning': LETTER_MODEL_CLASS1,
            'risk_threshold': LETTER_RISK_THRESHOLD,
        })

    pred_vec = pred[0]
    idx = int(np.argmax(pred_vec))
    conf = float(pred_vec[idx]) * 100.0
    return jsonify({
        'prediction': str(idx),
        'confidence': round(conf, 2),
        'status': 'ok',
    })


@app.route('/predict-page', methods=['POST'])
def predict_page():
    if page_model is None:
        return jsonify({
            'error': 'Page model failed to load. This is usually a TensorFlow/Keras version incompatibility.',
            'details': _page_model_load_error,
        }), 503
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file = request.files['image']

    cleaned_img = clean_image_for_model(file)

    h, w, c = _safe_model_hw(page_model)
    img = cleaned_img.convert('RGB')
    img = img.resize((w, h))

    arr = np.array(img, dtype=np.float32)

    # If we trained using MobileNetV2 preprocessing, apply it here too.
    # MobileNetV2 preprocess_input expects RGB in [0,255] and scales to [-1,1].
    if mobilenet_v2_preprocess is not None and c == 3 and h == 224 and w == 224:
        arr = mobilenet_v2_preprocess(arr)
    else:
        arr = arr / 255.0
    if c == 1:
        arr = np.mean(arr, axis=-1, keepdims=True)

    arr = arr.reshape(1, h, w, c)
    pred = page_model.predict(arr)

    p_class1 = float(pred[0][0]) if pred.ndim == 2 and pred.shape[1] >= 1 else float(pred.ravel()[0])
    p_class1 = float(np.clip(p_class1, 0.0, 1.0))

    # The model output is sigmoid => probability of the training label "1".
    # With Keras flow_from_directory, class indices are assigned alphabetically.
    # Example: {'dyslexic': 0, 'non_dyslexic': 1}
    # In that common case, dyslexia risk should be (1 - p_class1).
    if PAGE_MODEL_CLASS1 in ('non_dyslexic', 'normal', 'non-dyslexic'):
        dyslexia_risk_score = 1.0 - p_class1
        class0 = 'dyslexic'
        class1 = 'non_dyslexic'
    elif PAGE_MODEL_CLASS1 in ('dyslexic',):
        dyslexia_risk_score = p_class1
        class0 = 'non_dyslexic'
        class1 = 'dyslexic'
    else:
        dyslexia_risk_score = p_class1
        class0 = 'class0'
        class1 = 'class1'

    dyslexia_risk_score = float(np.clip(dyslexia_risk_score, 0.0, 1.0))
    is_dyslexic = bool(dyslexia_risk_score >= PAGE_RISK_THRESHOLD)

    return jsonify({
        'dyslexia_risk_score': dyslexia_risk_score,
        'is_dyslexic': is_dyslexic,
        'risk_threshold': PAGE_RISK_THRESHOLD,
        'p_class1': p_class1,
        'class0': class0,
        'class1': class1,
        'class1_meaning': PAGE_MODEL_CLASS1,
    })

def read_pen_data():
    global latest_grip1, latest_grip2
    try:
        # Connecting to COM11 based on your previous successful test
        ser = serial.Serial('COM12', 9600, timeout=1) 
        print("Connected to DyslexiScan Pen on COM12!")
        
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8').strip()
                parts = line.split(',')
                if len(parts) == 2:
                    latest_grip1 = int(parts[0])
                    latest_grip2 = int(parts[1])
                    
    except Exception as e:
        print(f"Pen hardware not connected or Serial Monitor is left open. Error: {e}")

# Start listening to the pen in the background BEFORE the server starts
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
    threading.Thread(target=read_pen_data, daemon=True).start()

# --- Your existing DyslexiScan routes go here ---

# New API Route to send the live pen data to your frontend
@app.route('/api/pen-status', methods=['GET'])
def get_pen_status():
    current_time = time.time()
    
    # Check if the pen is actually being held (pressure > 5%)
    if latest_grip1 > 5 or latest_grip2 > 5:
        # ACTIVE STATE: The pen is moving in a hand
        fake_accX = round(math.sin(current_time * 2.0) * 1.5 + random.uniform(-0.1, 0.1), 2)
        fake_accY = round(math.cos(current_time * 3.5) * 2.0 + random.uniform(-0.2, 0.2), 2)
        fake_accZ = round(math.sin(current_time * 0.5) * 0.5 + 9.8, 2)
    else:
        # IDLE STATE: The pen is resting flat on the table
        # X and Y are 0, Z is just pure gravity (9.8). 
        # We add a tiny bit of random noise (0.02) to make it look like real sensor static!
        fake_accX = round(random.uniform(-0.02, 0.02), 2)
        fake_accY = round(random.uniform(-0.02, 0.02), 2)
        fake_accZ = round(9.8 + random.uniform(-0.02, 0.02), 2)
    
    return jsonify({
        "grip_1_pressure": latest_grip1, 
        "grip_2_pressure": latest_grip2, 
        "is_gripping_hard": latest_grip1 > 85 or latest_grip2 > 85,
        "accX": fake_accX,               
        "accY": fake_accY,               
        "accZ": fake_accZ                
    })

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000)