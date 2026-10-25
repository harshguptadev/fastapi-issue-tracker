import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.core.permissions import get_issue_access, get_issue_or_404
from app.crud import get_user_by_email
from app.models import (
    Comment,
    CommentCreate,
    CommentPublic,
    CommentsPublic,
    Issue,
    IssueCreate,
    IssueDetailPublic,
    IssuePublic,
    IssueShare,
    IssueShareCreate,
    IssueSharePublic,
    IssueSharesPublic,
    IssuesPublic,
    IssueStatus,
    IssueUpdate,
    Message,
    User,
    get_datetime_utc,
)

router = APIRouter(prefix="/issues", tags=["issues"])


def _issue_to_public(issue: Issue) -> IssuePublic:
    return IssuePublic(
        **issue.model_dump(),
        owner_email=issue.owner.email,
        assignee_email=issue.assignee.email if issue.assignee else None,
    )


def _visible_issues_condition(current_user: User) -> ColumnElement[bool]:
    shared_issue_ids = select(IssueShare.issue_id).where(
        IssueShare.user_id == current_user.id
    )
    return or_(
        col(Issue.owner_id) == current_user.id,
        col(Issue.id).in_(shared_issue_ids),
    )


@router.get("/", response_model=IssuesPublic)
def read_issues(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    status: IssueStatus | None = None,
    priority: int | None = None,
    assignee_id: uuid.UUID | None = None,
) -> Any:
    """
    Retrieve issues owned by, or shared with, the current user.
    Superusers see all issues.
    """
    filters: list[ColumnElement[bool]] = []
    if status is not None:
        filters.append(col(Issue.status) == status)
    if priority is not None:
        filters.append(col(Issue.priority) == priority)
    if assignee_id is not None:
        filters.append(col(Issue.assignee_id) == assignee_id)

    if not current_user.is_superuser:
        filters.append(_visible_issues_condition(current_user))

    count_statement = select(func.count()).select_from(Issue).where(*filters)
    count = session.exec(count_statement).one()

    statement = (
        select(Issue)
        .where(*filters)
        .order_by(col(Issue.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    issues = session.exec(statement).all()

    issues_public = [_issue_to_public(issue) for issue in issues]
    return IssuesPublic(data=issues_public, count=count)


@router.get("/calendar", response_model=IssuesPublic)
def read_calendar_issues(
    session: SessionDep,
    current_user: CurrentUser,
    start: date,
    end: date,
) -> Any:
    """
    Retrieve visible issues with due dates inside an inclusive date range.
    """
    if start > end:
        raise HTTPException(
            status_code=400,
            detail="Start date must be on or before end date",
        )

    filters = [
        col(Issue.due_date).is_not(None),
        col(Issue.due_date) >= start,
        col(Issue.due_date) <= end,
    ]

    if not current_user.is_superuser:
        filters.append(_visible_issues_condition(current_user))

    statement = (
        select(Issue)
        .where(*filters)
        .order_by(
            col(Issue.due_date).asc(),
            col(Issue.created_at).desc(),
        )
    )
    issues = session.exec(statement).all()

    issues_public = [_issue_to_public(issue) for issue in issues]
    return IssuesPublic(data=issues_public, count=len(issues_public))


@router.get("/{id}", response_model=IssueDetailPublic)
def read_issue(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get issue by ID, including the current user's permissions on it.
    """
    access = get_issue_access(session, id, current_user)
    is_owner = current_user.is_superuser or access.is_owner
    return IssueDetailPublic(
        **_issue_to_public(access.issue).model_dump(),
        is_owner=is_owner,
        can_edit_status=access.can_edit_status,
        can_edit_assignee=access.can_edit_assignee,
    )


@router.post("/", response_model=IssuePublic)
def create_issue(
    *, session: SessionDep, current_user: CurrentUser, issue_in: IssueCreate
) -> Any:
    """
    Create a new issue.
    """
    issue = Issue.model_validate(issue_in, update={"owner_id": current_user.id})
    session.add(issue)
    session.commit()
    session.refresh(issue)
    return _issue_to_public(issue)


@router.put("/{id}", response_model=IssuePublic)
def update_issue(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    issue_in: IssueUpdate,
) -> Any:
    """
    Update an issue.

    The owner (or a superuser) may change any field. A user the issue was
    shared with may only change `status` (if granted) and/or `assignee_id`
    (if granted); any other field in the request is rejected.
    """
    access = get_issue_access(session, id, current_user)
    issue = access.issue

    update_dict = issue_in.model_dump(exclude_unset=True)

    if not access.is_owner:
        allowed_fields: set[str] = set()
        if access.can_edit_status:
            allowed_fields.add("status")
        if access.can_edit_assignee:
            allowed_fields.add("assignee_id")

        disallowed = set(update_dict) - allowed_fields
        if disallowed:
            raise HTTPException(
                status_code=403,
                detail=f"Not enough permissions to update: {', '.join(sorted(disallowed))}",
            )

    issue.sqlmodel_update(update_dict)
    issue.updated_at = get_datetime_utc()
    session.add(issue)
    session.commit()
    session.refresh(issue)
    return _issue_to_public(issue)


@router.delete("/{id}")
def delete_issue(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete an issue. Owner or superuser only.
    """
    issue = get_issue_or_404(session, id)
    if not current_user.is_superuser and issue.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(issue)
    session.commit()
    return Message(message="Issue deleted successfully")


@router.get("/{id}/comments", response_model=CommentsPublic)
def read_comments(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    List comments on an issue. Requires owner, shared, or superuser access.
    """
    get_issue_access(session, id, current_user)

    statement = (
        select(Comment)
        .where(Comment.issue_id == id)
        .order_by(col(Comment.created_at).desc())
    )
    comments = session.exec(statement).all()
    data = [
        CommentPublic(
            id=comment.id,
            issue_id=comment.issue_id,
            author_id=comment.author_id,
            author_email=comment.author.email,
            content=comment.content,
            created_at=comment.created_at,
        )
        for comment in comments
    ]
    return CommentsPublic(data=data, count=len(data))


@router.post("/{id}/comments", response_model=CommentPublic)
def create_comment(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    comment_in: CommentCreate,
) -> Any:
    """
    Add a comment to an issue. Requires owner, shared, or superuser access.
    """
    get_issue_access(session, id, current_user)

    comment = Comment(
        issue_id=id, author_id=current_user.id, content=comment_in.content
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return CommentPublic(
        id=comment.id,
        issue_id=comment.issue_id,
        author_id=comment.author_id,
        author_email=current_user.email,
        content=comment.content,
        created_at=comment.created_at,
    )


@router.get("/{id}/shares", response_model=IssueSharesPublic)
def read_shares(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    List the users an issue is shared with. Owner or superuser only.
    """
    issue = get_issue_or_404(session, id)
    if not current_user.is_superuser and issue.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    statement = select(IssueShare).where(IssueShare.issue_id == id)
    shares = session.exec(statement).all()
    data = [
        IssueSharePublic(
            id=share.id,
            issue_id=share.issue_id,
            user_id=share.user_id,
            user_email=share.user.email,
            can_edit_status=share.can_edit_status,
            can_edit_assignee=share.can_edit_assignee,
        )
        for share in shares
    ]
    return IssueSharesPublic(data=data)


@router.post("/{id}/shares", response_model=IssueSharePublic)
def create_share(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    share_in: IssueShareCreate,
) -> Any:
    """
    Share an issue with another user by email. Owner or superuser only.
    """
    issue = get_issue_or_404(session, id)
    if not current_user.is_superuser and issue.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    target_user = get_user_by_email(session=session, email=share_in.email)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.id == issue.owner_id:
        raise HTTPException(
            status_code=400, detail="Cannot share an issue with its owner"
        )

    share = IssueShare(
        issue_id=id,
        user_id=target_user.id,
        can_edit_status=share_in.can_edit_status,
        can_edit_assignee=share_in.can_edit_assignee,
    )
    session.add(share)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=400, detail="Issue already shared with this user"
        ) from exc
    session.refresh(share)
    return IssueSharePublic(
        id=share.id,
        issue_id=share.issue_id,
        user_id=share.user_id,
        user_email=target_user.email,
        can_edit_status=share.can_edit_status,
        can_edit_assignee=share.can_edit_assignee,
    )


@router.delete("/{id}/shares/{user_id}")
def delete_share(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    user_id: uuid.UUID,
) -> Message:
    """
    Revoke a user's access to a shared issue. Owner or superuser only.
    """
    issue = get_issue_or_404(session, id)
    if not current_user.is_superuser and issue.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    statement = select(IssueShare).where(
        IssueShare.issue_id == id, IssueShare.user_id == user_id
    )
    share = session.exec(statement).first()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    session.delete(share)
    session.commit()
    return Message(message="Access revoked successfully")
