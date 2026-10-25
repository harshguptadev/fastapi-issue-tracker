import uuid
from dataclasses import dataclass

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models import Issue, IssueShare, User


@dataclass
class IssueAccess:
    """Resolved access rights of a user on a given issue.

    Mirrors the permission rules of the Flask reference app: the owner (or a
    superuser) has full control, while a user the issue was shared with may
    only be granted the ability to change status and/or assignee.
    """

    issue: Issue
    is_owner: bool
    can_edit_status: bool
    can_edit_assignee: bool

    @property
    def can_edit_fully(self) -> bool:
        return self.is_owner


def get_issue_or_404(session: Session, issue_id: uuid.UUID) -> Issue:
    issue = session.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


def get_issue_access(
    session: Session, issue_id: uuid.UUID, user: User
) -> IssueAccess:
    """Load an issue and resolve the current user's access to it.

    Raises 404 if the issue doesn't exist, and 403 if the user has no
    relationship to it (not owner, not superuser, not shared with).
    """
    issue = get_issue_or_404(session, issue_id)

    if user.is_superuser or issue.owner_id == user.id:
        return IssueAccess(
            issue=issue, is_owner=True, can_edit_status=True, can_edit_assignee=True
        )

    share = session.exec(
        select(IssueShare).where(
            IssueShare.issue_id == issue_id, IssueShare.user_id == user.id
        )
    ).first()
    if not share:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return IssueAccess(
        issue=issue,
        is_owner=False,
        can_edit_status=share.can_edit_status,
        can_edit_assignee=share.can_edit_assignee,
    )
