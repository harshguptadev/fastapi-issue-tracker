import re
from difflib import SequenceMatcher
from typing import Any

from app.models import Issue

STOPWORDS = {
    "the", "is", "in", "at", "of", "that", "and", "to", "for", "without",
    "by", "its", "or", "a", "an", "on", "with", "as", "are", "be", "this",
    "from", "has", "have", "college", "institute", "institution", "university"
}

# Domain-specific semantic concept clusters (AICTE Approval Process Handbook taxonomy)
SEMANTIC_CLUSTERS = [
    {"unapproved", "unauthorized", "approval", "intake", "sanctioned", "courses", "programmes", "branch", "seats", "extension"},
    {"fee", "fees", "capitation", "donation", "refund", "overcharging", "tuition", "cash", "caution", "deposit"},
    {"salary", "salaries", "pay", "arrears", "faculty", "stipend", "withheld", "7th", "cpc", "pf", "deduction"},
    {"infrastructure", "lab", "laboratory", "fire", "building", "safety", "equipment", "noc", "library", "shortage"},
    {"ragging", "harassment", "hostel", "grievance", "disciplinary", "victim", "safety", "warden"},
    {"certificate", "documents", "original", "marksheet", "degree", "withholding", "retaining", "verification"},
]


def extract_aicte_pid(text: str) -> str | None:
    """Extract AICTE Permanent ID (e.g. 1-1234567890 or AICTE-XXXX) from text."""
    match = re.search(r"\b(1-\d{7,12}|AICTE-[A-Z0-9-]+)\b", text, re.IGNORECASE)
    return match.group(1).upper() if match else None


def extract_bureau(text: str) -> str:
    """Identify handling Bureau from text or prefix."""
    upper = text.upper()
    if "[RB]" in upper or "RB-" in upper or "REGULATION BUREAU" in upper or "SHOW-CAUSE" in upper:
        return "RB"
    return "PGRC"


def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return " ".join(text.split())


def compute_fuzzy_similarity(text_a: str, text_b: str) -> float:
    """Layer 2: Edit-distance and token-set similarity (Christen 2012)."""
    norm_a = normalize_text(text_a)
    norm_b = normalize_text(text_b)
    if not norm_a or not norm_b:
        return 0.0

    seq_ratio = SequenceMatcher(None, norm_a, norm_b).ratio() * 100.0

    tokens_a = set(norm_a.split()) - STOPWORDS
    tokens_b = set(norm_b.split()) - STOPWORDS
    if not tokens_a or not tokens_b:
        return round(seq_ratio, 1)

    token_overlap = (len(tokens_a & tokens_b) / max(len(tokens_a), len(tokens_b))) * 100.0
    return round(max(seq_ratio, token_overlap), 1)


def compute_semantic_similarity(text_a: str, text_b: str) -> tuple[float, list[str]]:
    """Layer 3: Semantic concept similarity across complaint narratives."""
    tokens_a = set(normalize_text(text_a).split()) - STOPWORDS
    tokens_b = set(normalize_text(text_b).split()) - STOPWORDS
    if not tokens_a or not tokens_b:
        return 0.0, []

    expanded_a = set(tokens_a)
    expanded_b = set(tokens_b)
    matched_concepts: list[str] = []

    for cluster in SEMANTIC_CLUSTERS:
        hit_a = tokens_a & cluster
        hit_b = tokens_b & cluster
        if hit_a and hit_b:
            expanded_a |= cluster
            expanded_b |= cluster
            matched_concepts.extend(list(hit_a | hit_b)[:3])

    intersection = len(expanded_a & expanded_b)
    union = len(expanded_a | expanded_b)
    score = (intersection / union) * 100.0 if union else 0.0
    return round(score, 1), sorted(set(matched_concepts))


def analyze_issue_pair(source: Issue, candidate: Issue) -> dict[str, Any] | None:
    """
    Evaluate two issues across Layer 1 (Exact ID), Layer 2 (Fuzzy), and Layer 3 (Semantic).
    Never auto-merges; returns explainable evidence for Human-in-the-Loop officer review.
    """
    src_full = f"{source.title} {source.description or ''}"
    cand_full = f"{candidate.title} {candidate.description or ''}"

    src_pid = extract_aicte_pid(src_full)
    cand_pid = extract_aicte_pid(cand_full)

    src_bureau = extract_bureau(src_full)
    cand_bureau = extract_bureau(cand_full)

    # If both specify different AICTE Permanent IDs, they belong to different institutions
    if src_pid and cand_pid and src_pid != cand_pid:
        return None

    pid_matched = bool(src_pid and cand_pid and src_pid == cand_pid)

    fuzzy_score = compute_fuzzy_similarity(src_full, cand_full)
    semantic_score, concepts = compute_semantic_similarity(src_full, cand_full)

    # Hard-reject matches where PIDs match by coincidence but both text metrics are low
    if pid_matched and (semantic_score < 50.0 and fuzzy_score < 50.0):
        return None

    # Composite confidence score
    base_score = max(fuzzy_score * 0.85, semantic_score)
    if pid_matched:
        base_score = min(99.0, base_score + 25.0)

    confidence = round(base_score, 1)

    # Threshold for raising an overlap alert
    if confidence < 50.0:
        return None

    if pid_matched and semantic_score >= 40.0:
        layer = "Layer 1 (Exact PID) + Layer 3 (Semantic Match)"
    elif semantic_score >= fuzzy_score:
        layer = "Layer 3: Semantic Narrative Similarity"
    else:
        layer = "Layer 2: Fuzzy Token & Edit-Distance Match"

    cross_bureau = src_bureau != cand_bureau
    reasons: list[str] = []
    if pid_matched:
        reasons.append(f"Exact AICTE Permanent ID match ({src_pid})")
    if cross_bureau:
        reasons.append(f"Cross-Bureau activity detected ({src_bureau} ↔ {cand_bureau})")
    if concepts:
        reasons.append(f"Shared regulatory concepts: {', '.join(concepts[:4])}")
    reasons.append(f"Fuzzy similarity: {fuzzy_score}%, Semantic similarity: {semantic_score}%")

    return {
        "candidate_id": str(candidate.id),
        "candidate_title": candidate.title,
        "candidate_status": str(candidate.status),
        "candidate_bureau": cand_bureau,
        "source_bureau": src_bureau,
        "aicte_pid": src_pid or cand_pid or "Unverified",
        "cross_bureau": cross_bureau,
        "confidence_score": confidence,
        "match_layer": layer,
        "explanation": " · ".join(reasons),
        "owner_email": candidate.owner.email,
        "due_date": str(candidate.due_date) if candidate.due_date else None,
    }