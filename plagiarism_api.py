import re
from typing import List, Dict, Any
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["Plagiarism Detection"])

# Reference Knowledge Base corpus
REFERENCE_DATABASE = [
    "Artificial intelligence is transforming industries across the globe through automated systems.",
    "Machine learning algorithms analyze large datasets to identify patterns and make predictions.",
    "Deep learning relies on artificial neural networks inspired by the human brain structure.",
    "Natural Language Processing enables computers to understand, interpret, and generate human language.",
    "Plagiarism involves taking someone else's work or ideas and passing them off as one's own.",
    "Recent advancements in transformer-based vision architectures have demonstrated state-of-the-art capability in generative representation learning.",
    "By replacing standard convolutional layers with self-attention across image patches, these architectures capture global contextual dependencies effectively.",
    "Quadratic memory complexity remains a limiting bottleneck during dense spatial tasks in vision transformers.",
    "Convolutional neural networks extract hierarchical spatial representations using localized kernel sliding operations.",
    "Large language models utilize multi-head attention mechanisms to predict next tokens across extensive textual sequences.",
    "Supervised fine-tuning aligns pre-trained generative foundation models with human intent and task instructions.",
    "Cosine similarity measures the angular distance between normalized high-dimensional dense vector embeddings."
]

# Try loading SentenceTransformer model if available in the runtime
model = None
try:
    from sentence_transformers import SentenceTransformer
    print("Loading Sentence-BERT model (sentence-transformers/all-MiniLM-L6-v2)...")
    model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
    print("Sentence-BERT model loaded successfully!")
except Exception as e:
    print(f"SentenceTransformer not available ({e}), using resilient semantic n-gram TF-IDF vectorizer fallback.")

def split_into_sentences(text: str) -> List[str]:
    """Splits input text into individual clean sentences."""
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sentences if len(s.strip()) > 5]

def tfidf_vectorize(sentences: List[str], vocabulary: List[str]) -> np.ndarray:
    """Lightweight TF-IDF / Bag-of-Ngrams vectorizer fallback."""
    vecs = []
    vocab_map = {term: idx for idx, term in enumerate(vocabulary)}
    for s in sentences:
        words = re.findall(r'\b\w{3,}\b', s.lower())
        vec = np.zeros(len(vocabulary), dtype=float)
        for w in words:
            if w in vocab_map:
                vec[vocab_map[w]] += 1.0
        # Character 3-grams for semantic typo & stem resilience
        for i in range(len(s) - 2):
            gram = s[i:i+3].lower()
            if gram in vocab_map:
                vec[vocab_map[gram]] += 0.5
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        vecs.append(vec)
    return np.array(vecs)

def calculate_plagiarism(
    input_text: str,
    reference_docs: List[str],
    threshold: float = 0.65
) -> Dict[str, Any]:
    input_sentences = split_into_sentences(input_text)
    if not input_sentences:
        return {
            "plagiarism_percentage": 0.0,
            "total_sentences": 0,
            "flagged_sentences": 0,
            "matches": []
        }

    matches = []
    plagiarized_count = 0

    if model is not None:
        from sklearn.metrics.pairwise import cosine_similarity
        input_embeddings = model.encode(input_sentences, convert_to_numpy=True)
        ref_embeddings = model.encode(reference_docs, convert_to_numpy=True)
        sim_matrix = cosine_similarity(input_embeddings, ref_embeddings)

        for idx, sentence in enumerate(input_sentences):
            scores = sim_matrix[idx]
            max_similarity = float(np.max(scores))
            matched_ref_index = int(np.argmax(scores))

            if max_similarity >= threshold:
                plagiarized_count += 1
                matches.append({
                    "sentence_index": idx,
                    "input_sentence": sentence,
                    "similarity_score": round(max_similarity * 100, 2),
                    "matched_source": reference_docs[matched_ref_index]
                })
    else:
        # Build vocabulary from both input and reference corpus
        raw_words = set(re.findall(r'\b\w{3,}\b', " ".join(input_sentences + reference_docs).lower()))
        grams = set()
        for doc in (input_sentences + reference_docs):
            for i in range(len(doc) - 2):
                grams.add(doc[i:i+3].lower())
        vocab = list(raw_words | grams)

        input_vecs = tfidf_vectorize(input_sentences, vocab)
        ref_vecs = tfidf_vectorize(reference_docs, vocab)
        sim_matrix = np.dot(input_vecs, ref_vecs.T)

        for idx, sentence in enumerate(input_sentences):
            scores = sim_matrix[idx]
            max_similarity = float(np.max(scores)) if len(scores) > 0 else 0.0
            matched_ref_index = int(np.argmax(scores)) if len(scores) > 0 else 0

            # Slightly lower threshold scale for sparse TF-IDF vs dense embeddings
            normalized_score = min(1.0, max_similarity * 1.15)
            if normalized_score >= threshold:
                plagiarized_count += 1
                matches.append({
                    "sentence_index": idx,
                    "input_sentence": sentence,
                    "similarity_score": round(normalized_score * 100, 2),
                    "matched_source": reference_docs[matched_ref_index]
                })

    plagiarism_percentage = (plagiarized_count / len(input_sentences)) * 100

    return {
        "plagiarism_percentage": round(plagiarism_percentage, 2),
        "total_sentences": len(input_sentences),
        "flagged_sentences": plagiarized_count,
        "matches": matches,
        "model_used": "sentence-bert/all-MiniLM-L6-v2" if model is not None else "semantic-ngram-tfidf"
    }

class PlagiarismRequest(BaseModel):
    text: str
    similarity_threshold: float = 0.65

@router.post("/check-plagiarism")
@router.post("/api/check-plagiarism")
def check_plagiarism_endpoint(payload: PlagiarismRequest):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text input cannot be empty.")
    
    return calculate_plagiarism(
        input_text=payload.text,
        reference_docs=REFERENCE_DATABASE,
        threshold=payload.similarity_threshold
    )
