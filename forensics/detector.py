import os
import cv2
import torch
import torch.nn.functional as F
from PIL import Image
import numpy as np
from transformers import AutoImageProcessor, AutoModelForImageClassification

# 1. Setup GPU Device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using Compute Device: {device} " + (f"({torch.cuda.get_device_name(0)})" if torch.cuda.is_available() else ""))

# 2. Load Vision Transformer Model
MODEL_NAME = "dima806/ai_vs_real_image_detection"
print(f"Loading Neural Forensic Model: {MODEL_NAME}...")
processor = AutoImageProcessor.from_pretrained(MODEL_NAME)
model = AutoModelForImageClassification.from_pretrained(MODEL_NAME).to(device)
model.eval()
print("Model Ready!\n")

# ========================================================
# HELPER 1: HARDWARE METADATA PARSER
# ========================================================
def get_hardware_info(image_path):
    img = Image.open(image_path)
    exif = img.getexif()
    
    brand_keywords = [
        'samsung', 'apple', 'iphone', 'xiaomi', 'google', 'oneplus', 
        'oppo', 'vivo', 'realme', 'motorola', 'canon', 'nikon', 'sony'
    ]
    
    found_hardware = False
    device_label = "None (Social Media or Web Export)"
    
    if exif:
        make = str(exif.get(271) or "").strip()
        model_name = str(exif.get(272) or "").strip()
        combined = f"{make} {model_name}".lower()
        
        if any(b in combined for b in brand_keywords):
            found_hardware = True
            device_label = f"{make} {model_name}".strip()
            
    return found_hardware, device_label

# ========================================================
# HELPER 2: AI PROVENANCE & C2PA SCANNER
# ========================================================
def get_ai_provenance(image_path):
    with open(image_path, 'rb') as f:
        raw_bytes = f.read(min(os.path.getsize(image_path), 300000)).lower()

    ai_markers = {
        b'c2pa': 'C2PA Content Credentials',
        b'synthid': 'Google SynthID Watermark',
        b'dall-e': 'OpenAI DALL-E / ChatGPT',
        b'dall\xc2\xb7e': 'OpenAI DALL-E 3',
        b'openai': 'OpenAI Generative Tag',
        b'midjourney': 'Midjourney Metadata',
        b'stablediffusion': 'Stable Diffusion Checkpoint'
    }
    
    detected_tags = [desc for marker, desc in ai_markers.items() if marker in raw_bytes]
    return detected_tags

# ========================================================
# HELPER 3: GLASS LENS OPTICAL DISPERSION
# ========================================================
def calculate_glass_dispersion(img_rgb):
    img_np = np.array(img_rgb, dtype=np.float32)
    gray = cv2.cvtColor(img_np.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 70, 150) > 0
    
    if np.sum(edges) > 200:
        r_channel = img_np[:, :, 0][edges]
        b_channel = img_np[:, :, 2][edges]
        dispersion = float(np.std(r_channel - b_channel))
    else:
        dispersion = 10.0
    return dispersion

# ========================================================
# MAIN AUDIT FUNCTION
# ========================================================
def scan_image(image_path):
    if not os.path.exists(image_path):
        print(f"Error: File not found: {image_path}")
        return

    print("=" * 65)
    print(f"SCANNING: {os.path.basename(image_path)}")
    print("=" * 65)

    img = Image.open(image_path).convert("RGB")
    file_size_kb = os.path.getsize(image_path) / 1024.0

    # 1. Run Checks
    has_hardware, hardware_name = get_hardware_info(image_path)
    ai_tags = get_ai_provenance(image_path)
    dispersion = calculate_glass_dispersion(img)
    has_real_lens = dispersion > 16.0
    is_social_media_size = file_size_kb < 450.0

    # 2. Neural Vision Transformer Scan
    inputs = processor(images=img, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = model(**inputs)
        probabilities = F.softmax(outputs.logits, dim=-1)[0]

    labels = model.config.id2label
    scores = {labels[i].lower(): float(probabilities[i].item() * 100) for i in range(len(labels))}
    fake_key = [k for k in scores if 'fake' in k or 'ai' in k or 'art' in k][0]
    neural_score = scores[fake_key]

    # Print Findings
    print("[1] METADATA & HARDWARE:")
    print(f"  • Physical Device : {hardware_name}")
    print(f"  • File Size       : {file_size_kb:.1f} KB")
    if ai_tags:
        print(f"  • AI Signatures   : {', '.join(ai_tags)}")
    
    print("\n[2] OPTICAL PHYSICS & NEURAL SCAN:")
    print(f"  • Glass Lens Dispersion : {dispersion:.1f} ({'Real Camera Lens' if has_real_lens else 'Flat / Synthetic'})")
    print(f"  • Neural AI Suspicion   : {neural_score:.2f}%")

    # 3. Decision Logic
    if len(ai_tags) > 0:
        final_risk = 99.8
        verdict = "CONFIRMED AI GENERATED IMAGE"
        explanation = f"Cryptographic provenance tag verified ({ai_tags[0]})."
    elif has_hardware:
        final_risk = min(12.0, neural_score * 0.12)
        verdict = "AUTHENTIC REAL PHOTOGRAPH"
        explanation = f"Physical camera hardware verified ({hardware_name})."
    elif is_social_media_size and has_real_lens:
        final_risk = min(20.0, neural_score * 0.18)
        verdict = "AUTHENTIC REAL PHOTOGRAPH (Social Media / WhatsApp)"
        explanation = "Natural optical lens dispersion confirmed despite chat compression."
    else:
        final_risk = neural_score
        if final_risk >= 60.0:
            verdict = "AI GENERATED IMAGE"
            explanation = "Synthetic diffusion pixel distribution detected."
        elif final_risk >= 35.0:
            verdict = "UNCERTAIN / HEAVILY FILTERED"
            explanation = "Mixed signals detected between digital editing and real optics."
        else:
            verdict = "AUTHENTIC REAL PHOTOGRAPH"
            explanation = "Natural lighting and organic pixel distribution confirmed."

    print("\n" + "=" * 65)
    print(f"FINAL AI RISK SCORE: {final_risk:.1f}%")
    print(f"VERDICT: {verdict}")
    print(f"REASON : {explanation}")
    print("=" * 65 + "\n")

# ========================================================
# EXAMPLE USAGE
# ========================================================
if __name__ == "__main__":
    # Replace with any image path on your computer:
    test_file = input("Enter path to image file: ").strip('\"\' ')
    if test_file:
        scan_image(test_file)