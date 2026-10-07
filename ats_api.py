import io
import re
import os
import joblib

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pypdf import PdfReader
from docx import Document


router = APIRouter(prefix="/api/ats", tags=["ATS"])


MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "ats",
    "models",
    "docmorph_ats_model.joblib"
)


# Load model once when API starts
try:
    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    vectorizer = bundle["vectorizer"]
    ATS_READY = True
    print("✅ ATS model loaded successfully")
except Exception as e:
    model = None
    vectorizer = None
    ATS_READY = False
    print(f"⚠️ ATS model loading failed: {e}")


def extract_text(filename: str, data: bytes) -> str:

    name = (filename or "").lower()

    if name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        )

    if name.endswith(".docx"):
        doc = Document(io.BytesIO(data))
        return "\n".join(
            p.text for p in doc.paragraphs
        )

    if name.endswith(".txt"):
        return data.decode(
            "utf-8",
            errors="ignore"
        )

    raise ValueError(
        "Only PDF, DOCX and TXT resumes are supported."
    )


@router.get("/status")
def ats_status():
    return {
        "ats_ready": ATS_READY,
        "model": "docmorph-ats-v1"
    }


@router.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_description: str = Form(...)
):

    if not ATS_READY:
        raise HTTPException(
            status_code=503,
            detail="ATS model is not available."
        )

    try:

        data = await file.read()

        resume = extract_text(
            file.filename or "",
            data
        )

        resume = re.sub(
            r"\s+",
            " ",
            resume
        ).strip()

        job_description = re.sub(
            r"\s+",
            " ",
            job_description
        ).strip()

        if not resume:
            raise ValueError(
                "Could not extract text from resume."
            )

        if not job_description:
            raise ValueError(
                "Job description cannot be empty."
            )

        # SAME FORMAT USED DURING TRAINING
        combined = (
            "RESUME: " + resume +
            "\nJOB DESCRIPTION: " + job_description
        )

        X = vectorizer.transform([combined])

        prediction = model.predict(X)[0]

        probabilities = model.predict_proba(X)[0]

        confidence = float(max(probabilities))

        probability_map = {
            label: round(float(prob), 4)
            for label, prob in zip(
                model.classes_,
                probabilities
            )
        }

        # UI score = prediction confidence.
        # This is NOT the model's benchmark accuracy.
        match_score = round(confidence * 100)

        # ----------------------------------------------------
        # Keyword analysis
        # ----------------------------------------------------

        resume_words = set(
            re.findall(
                r"\b[a-zA-Z][a-zA-Z0-9+#./-]{2,}\b",
                resume.lower()
            )
        )

        jd_words = set(
            re.findall(
                r"\b[a-zA-Z][a-zA-Z0-9+#./-]{2,}\b",
                job_description.lower()
            )
        )

        stop_words = {
            "the", "and", "for", "with", "that",
            "this", "from", "your", "you", "are",
            "our", "will", "have", "has", "their",
            "they", "into", "about", "using",
            "work", "working", "years", "year",
            "role", "job", "candidate", "required",
            "requirements", "experience", "skills",
            "skill"
        }

        keywords = [
            word for word in jd_words
            if word not in stop_words
        ]

        matched = [
            word for word in keywords
            if word in resume_words
        ]

        missing = [
            word for word in keywords
            if word not in resume_words
        ]

        word_count = len(
            re.findall(
                r"\b\w+\b",
                resume
            )
        )

        return {
            "success": True,
            "filename": file.filename,
            "prediction": prediction,
            "match_score": match_score,
            "confidence": round(confidence, 4),
            "probabilities": probability_map,
            "word_count": word_count,
            "matched_keywords": matched[:20],
            "missing_keywords": missing[:10],
            "model": "docmorph-ats-v1"
        }

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"ATS analysis failed: {str(e)}"
        )
