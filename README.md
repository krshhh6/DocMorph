# DocMorph: File Studio Pro

> **A unified, privacy-first web suite and forensic engine for intelligent document transformation, biometric media processing, and multi-modal deepfake detection.**

[![React](https://img.shields.io/badge/React-19.0.0-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38bdf8.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-CUDA_12.8-ee4c2c.svg?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌟 Overview

Everyday digital tasks force students, professionals, and recruiters across dozens of fragmented, ad-ridden web portals just to compress a PDF, audit an ATS resume, frame a biometric passport photograph, or authenticate synthetic media.

**DocMorph** solves this by unifying mission-critical file workflows into an elegant, high-performance client interface backed by local hardware-accelerated forensic models. Sensitive files are processed locally with zero telemetry and complete privacy.

---

## 🚀 Core Capabilities

### 1. 🛡️ Multi-Modal Deepfake Forensic Detector *(Flagship AI Engine)*
- **Dual-Model Neural Classification**: Fine-tuned Vision Transformer (`dima806/ai_vs_real_image_detection`) and EfficientNet-B0 running on hardware-accelerated GPUs and Web-optimized inference engines.
- **7-Layer Image Audit**:
  - **C2PA Provenance Manifests**: Cryptographic signature validation for synthetic media origin (OpenAI DALL-E, Midjourney, Google Imagen).
  - **Hardware Sensor & EXIF Analysis**: Camera make/model verification vs. web export sanitization.
  - **Error Level Analysis (ELA)**: Compression artifact heatmaps highlighting localized edits.
  - **2D Fast Fourier Transform (FFT)**: High-frequency spectrum analysis detecting generative grid artifacts.
  - **Optical Chromatic Dispersion**: Lens physics consistency verification.
- **Temporal Video Deepfake Scanner**: Uniform keyframe extraction via OpenCV with temporal variance tracking ($\sigma > 5.0$) to detect frame-splicing and face swaps.

### 2. 📄 ATS Resume Optimizer
- **Real-Time Score Gauge**: Live benchmark scoring against target job descriptions.
- **Competency Gap Chips**: High/Medium severity tags highlighting missing keywords and skills.
- **Formatting Compliance**: Flags multi-column parse traps, tables, and non-standard typography.
- **Readability Index**: Word density and grade-level readability metrics.

### 3. 🗜️ Smart File Compressor
- **Visual-Lossless Reduction**: Granular quality sliders (10% to 95%) with instant output size estimations.
- **Interactive Split Slider**: Real-time side-by-side comparison before downloading.
- **Client-Accelerated**: Reduces file footprints by ~66% with zero server upload latency.

### 4. 📸 Biometric Passport Photo Studio
- **ICAO Biometric Alignment Overlay**: Official guidelines for eye level, crown margin, and chin height.
- **1-Click AI Backgrounds**: Instant replacement with Pure White, Off-White, and Pale Blue presets.
- **International Profiles**: US (2x2"), UK/Schengen (35x45mm), and India standards.
- **Print Exporter**: Instant 300 DPI 6-photo print sheet generation.

### 5. 📑 Three-Tier Document Summarizer
- **Distillation Tiers**: Executive Summary, Balanced Overview, and Detailed Analysis modes.
- **Dual-Pane Interface**: Side-by-side document preview with structured markdown notes.
- **Categorical Extraction**: Automated breakdown of financial tables, risks, and strategic takeaways.

### 6. 🔄 Universal Converter Engine
- **Multi-Format Batching**: Convert seamlessly between PDF, DOCX, PNG, JPG, and WEBP.
- **Queue & Audit Logging**: Track processing states, file sizes, and export individual files or bundled ZIP archives.

---

## 🛠️ Architecture & Tech Stack

```
DocMorph/
├── src/
│   ├── components/
│   │   ├── Tools.tsx          # Interactive workbench for all 6 core tools
│   │   ├── Workspace.tsx      # Main workspace and active tool canvas
│   │   ├── Shell.tsx          # Top navigation bar, status chips & layout shell
│   │   ├── Team.tsx           # Creator & team profile cards
│   │   ├── LoadingScreen.tsx  # Initial telemetry boot sequence
│   │   └── ui.tsx             # Reusable design system primitives
│   ├── App.tsx                # Master state controller & routing
│   ├── index.css              # Custom design tokens & Tailwind CSS v4 styling
│   └── main.tsx               # Application mount point
├── forensics/
│   └── detector.py            # Local PyTorch Vision Transformer & forensic scanner
├── docs/                      # Research reports & technical documentation
├── vite.config.ts             # Vite configuration with Tailwind v4 & aliases
└── package.json               # Project manifest
```

- **Frontend**: React 19, TypeScript 5.7, Tailwind CSS v4, Lucide Icons, Vite 8
- **Forensic Backend**: Python 3.13, PyTorch 2.6 (CUDA 12.8), HuggingFace Transformers, OpenCV, NumPy, Pillow

---

## ⚡ Quick Start

### Frontend (Studio UI)

```bash
# 1. Install dependencies
npm install

# 2. Start the local development server
npm run dev
```

The application will launch at `http://localhost:8443/`.

### Forensic Detector (Python Engine)

```bash
# 1. Navigate to the forensics directory
cd forensics

# 2. Install Python requirements
pip install torch torchvision transformers opencv-python pillow numpy

# 3. Run forensic inference on media
python detector.py
```

---

## 👥 Authors & Team

- **Krishna Kant** ([@krshhh6](https://github.com/krshhh6)) — *Creator · Frontend Architecture, File Conversions, AI Forensics & Video Deepfake Engine*
- **Sampoorn Tripathi** — *ATS Resume Scoring Engine & AI Summarizer*
- **Divyam Pathak** ([@divyam-pathak02](https://github.com/divyam-pathak02)) — *Passport Photo Studio & Plagiarism Analyzer*

*B.Tech Computer Science & Engineering — Semester 3 Project*

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
