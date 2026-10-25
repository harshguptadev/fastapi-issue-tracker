from sqlmodel import Session

from app import crud
from app.models import Issue, IssueCreate
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def create_random_issue(db: Session, owner_id=None) -> Issue:
    if owner_id is None:
        user = create_random_user(db)
        owner_id = user.id
    assert owner_id is not None
    title = random_lower_string()
    description = random_lower_string()
    issue_in = IssueCreate(title=title, description=description)
    return crud.create_issue(session=db, issue_in=issue_in, owner_id=owner_id)
