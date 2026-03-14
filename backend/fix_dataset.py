import cv2
import os
import numpy as np
from glob import glob

# Define your base data paths
BASE_FOLDERS = ["data/normal", "data/dyslexic"]

def normalize_background(img_path):
    # 1. Read image in Grayscale
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        # This skips folders/non-image files silently
        return

    # 2. Check brightness
    avg_brightness = np.mean(img)

    # 3. Decision Logic:
    # If average is LOW (< 127), it is White text on Black background.
    # We want to FLIP it to be Black text on White Paper.
    if avg_brightness < 127:
        print(f"Inverting dark background: {img_path}")
        img = cv2.bitwise_not(img) 
        cv2.imwrite(img_path, img) 

print("Starting recursive dataset cleanup...")

for base_folder in BASE_FOLDERS:
    # The 'recursive=True' flag tells it to dig into subfolders (A, B, C...)
    # We look for png, jpg, jpeg, and bmp
    search_pattern = os.path.join(base_folder, "**", "*.*") 
    files = glob(search_pattern, recursive=True)
    
    print(f"Found {len(files)} files in {base_folder} (including subfolders)...")
    
    for f in files:
        # Only process if it is actually an image file
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp')):
            normalize_background(f)

print("DONE! All images are now Dark Text on Light Background.")