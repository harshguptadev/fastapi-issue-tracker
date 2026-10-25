import pytest
from app.core.overlap_engine import analyze_issue_pair, extract_aicte_pid, extract_bureau

class MockOwner:
    def __init__(self, email="test@example.com"):
        self.email = email

class MockIssue:
    def __init__(self, id="1", title="", description="", status="Open", owner_email="test@example.com", due_date=None):
        self.id = id
        self.title = title
        self.description = description
        self.status = status
        self.owner = MockOwner(owner_email)
        self.due_date = due_date

def test_extract_aicte_pid():
    text = "Institution ID: 1-987654321 and some text"
    assert extract_aicte_pid(text) == "1-987654321"
    assert extract_aicte_pid("No ID here") is None

def test_extract_bureau():
    assert extract_bureau("PGRC Bureau issue") == "PGRC"
    assert extract_bureau("General issue") == "General"

def test_analyze_issue_pair_different_pids():
    source = MockIssue(title="Issue A", description="Institution ID: 1-111111111")
    candidate = MockIssue(title="Issue B", description="Institution ID: 1-222222222")
    result = analyze_issue_pair(source, candidate)
    assert result is None

def test_analyze_issue_pair_hard_reject_low_similarity():
    source = MockIssue(title="Severe ragging complaint in hostel", description="Institution ID: 1-987654321")
    candidate = MockIssue(title="Unapproved structural expansion", description="Institution ID: 1-987654321")
    result = analyze_issue_pair(source, candidate)
    assert result is None

def test_analyze_issue_pair_true_overlap():
    source = MockIssue(
        title="Delay in scholarship disbursement", 
        description="Students have not received post-matrix scholarships. Institution ID: 1-987654321"
    )
    candidate = MockIssue(
        title="Pending fee refund and scholarship issues", 
        description="Scholarship and fee refund delays at tech campus. Institution ID: 1-987654321"
    )
    result = analyze_issue_pair(source, candidate)
    assert result is not None
    assert result["confidence_score"] >= 50.0
    assert "Exact AICTE Permanent ID match" in result["explanation"]