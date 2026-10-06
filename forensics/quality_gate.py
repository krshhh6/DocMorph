import re

STD_LUMA_SUM = 3688  # sum of standard JPEG luminance quantization table (quality 50)
PINTEREST_WIDTHS = [236, 474, 564, 736]
SCREEN_SIZES = [
    (1920, 1080), (1366, 768), (1536, 864), (1440, 900), (2560, 1440),
    (1080, 2400), (1080, 2340), (1170, 2532), (1284, 2778), (1080, 1920), (750, 1334)
]

def classify_source(name: str) -> str:
    if re.search(r"whatsapp|^IMG-\d{8}-WA", name, re.IGNORECASE):
        return "whatsapp"
    if re.search(r"screen[\s_-]?shot|^Capture", name, re.IGNORECASE):
        return "screenshot"
    if re.search(r"^WIN_\d{8}_", name, re.IGNORECASE):
        return "webcam"
    return "unknown"

def estimate_jpeg_quality(raw_bytes: bytes) -> int | None:
    try:
        p = 2
        n = len(raw_bytes)
        while p + 4 < n:
            if raw_bytes[p] != 0xff:
                p += 1
                continue
            marker = raw_bytes[p + 1]
            if marker == 0xda:
                break
            if marker in (0xff, 0x00):
                p += 1
                continue
            length = (raw_bytes[p + 2] << 8) | raw_bytes[p + 3]
            if marker == 0xdb:
                q = p + 4
                end = p + 2 + length
                while q < end:
                    info = raw_bytes[q]
                    q += 1
                    wide = (info >> 4) == 1
                    table_id = info & 15
                    t_sum = 0
                    for _ in range(64):
                        if wide:
                            t_sum += (raw_bytes[q] << 8) | raw_bytes[q + 1]
                            q += 2
                        else:
                            t_sum += raw_bytes[q]
                            q += 1
                    if table_id == 0:
                        scale = (t_sum / STD_LUMA_SUM) * 100.0
                        quality = 5000.0 / scale if scale > 100.0 else (200.0 - scale) / 2.0
                        return max(1, min(100, round(quality)))
            p += 2 + length
    except Exception:
        pass
    return None

def assess_input_quality(pil_img, raw_bytes: bytes, has_exif: bool, filename: str):
    W, H = pil_img.size
    min_side = min(W, H)
    source = classify_source(filename)
    jpeg_quality = estimate_jpeg_quality(raw_bytes)
    flags = []
    notes = []

    # ---- HARD flags: forensic signals are genuinely unusable ----
    is_screen_size = any((W == w and H == h) or (W == h and H == w) for w, h in SCREEN_SIZES)
    is_png = filename.lower().endswith(".png")

    if source == "screenshot" or (is_screen_size and not has_exif and is_png):
        flags.append({"label": "Screenshot", "severity": "hard"})

    if not has_exif and (W in PINTEREST_WIDTHS or H in PINTEREST_WIDTHS):
        flags.append({"label": "Social-media resized copy", "severity": "hard"})

    if min_side < 300:
        flags.append({"label": "Very low resolution", "severity": "hard"})

    if jpeg_quality is not None and jpeg_quality < 45:
        flags.append({"label": "Heavily compressed", "severity": "hard"})

    # ---- SOFT flags: still analyzable, but with reduced confidence ----
    if source == "whatsapp":
        flags.append({"label": "Re-compressed by WhatsApp", "severity": "soft"})

    if jpeg_quality is not None and 45 <= jpeg_quality < 70:
        flags.append({"label": "Moderately compressed", "severity": "soft"})

    if 300 <= min_side < 480:
        flags.append({"label": "Low resolution", "severity": "soft"})

    # ---- Informational only ----
    if not has_exif:
        notes.append("No camera metadata (normal for webcams and messaging apps).")
    if source == "webcam":
        notes.append("Looks like a Windows Camera capture.")

    has_hard = any(f["severity"] == "hard" for f in flags)
    if has_hard:
        confidence = "unreliable"
    elif len(flags) > 0:
        confidence = "reduced"
    else:
        confidence = "high"

    return {
        "confidence": confidence,
        "source": source,
        "jpegQuality": jpeg_quality,
        "flags": flags,
        "notes": notes,
        "reliable": confidence != "unreliable",
        "reasons": [f["label"] for f in flags]
    }

BANDS = {
    "high": {"real": 35, "ai": 65},
    "reduced": {"real": 25, "ai": 75}
}

def decide_verdict(quality_report: dict, ai_score: float | None):
    conf = quality_report.get("confidence", "high")
    if conf == "unreliable" or ai_score is None:
        return {"verdict": "inconclusive", "showScore": False, "caveat": None}

    b = BANDS.get(conf, BANDS["high"])
    caveat = "Reduced confidence" if conf == "reduced" else None

    if ai_score < b["real"]:
        return {"verdict": "real", "showScore": True, "caveat": caveat}
    if ai_score >= b["ai"]:
        return {"verdict": "ai", "showScore": True, "caveat": caveat}
    return {"verdict": "inconclusive", "showScore": False, "caveat": caveat}
