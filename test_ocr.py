import cv2
import easyocr
from fuzzywuzzy import fuzz
from pathlib import Path

img_path = r"c:\Users\savma\OneDrive\Documents\Projects\spot-me\bruh.png"
if not Path(img_path).exists():
    print("bruh.png not found")
    exit()

reader = easyocr.Reader(['en'])

img = cv2.imread(str(img_path))
result = reader.readtext(img)

texts = []
print("OCR detections (box, text, confidence):")
for detection in result:
    bbox, text, confidence = detection
    print(f"  bbox={bbox}, text='{text}', conf={confidence:.4f}")
    if confidence > 0.1:  # lower threshold for debug
        texts.append(text.lower())

print("Parsed texts:")
for t in texts:
    print(f"  - {t}")

exact_found = any("santoblue" in t for t in texts)
fuzzy_found = any(fuzz.ratio("santoblue", t) >= 70 for t in texts)

print(f"Exact match: {exact_found}")
print(f"Fuzzy match: {fuzzy_found}")
print(f"Found: {exact_found or fuzzy_found}")
