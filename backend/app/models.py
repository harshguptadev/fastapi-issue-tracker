import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from pydantic import EmailStr
from sqlalchemy import Column, DateTime, String, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    is_superuser: bool | None = None
    full_name: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    issues: list[Issue] = Relationship(
        back_populates="owner",
        cascade_delete=True,
        sa_relationship_kwargs={"foreign_keys": "Issue.owner_id"},
    )
    assigned_issues: list[Issue] = Relationship(
        back_populates="assignee",
        sa_relationship_kwargs={"foreign_keys": "Issue.assignee_id"},
    )
    issue_shares: list[IssueShare] = Relationship(
        back_populates="user", cascade_delete=True
    )


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


class IssueStatus(StrEnum):
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    DONE = "Done"


# Shared properties
class IssueBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    # Stored as a plain varchar (not a native Postgres enum) to keep schema
    # changes to the allowed values a simple app-level concern.
    status: IssueStatus = Field(
        default=IssueStatus.OPEN, sa_column=Column(String(20), nullable=False)
    )
    priority: int = Field(default=3, ge=1, le=5)
    due_date: date | None = None


# Properties to receive on issue creation
class IssueCreate(IssueBase):
    assignee_id: uuid.UUID | None = None


# Properties to receive on issue update
class IssueUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    status: IssueStatus | None = None
    priority: int | None = Field(default=None, ge=1, le=5)
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None


# Database model, database table inferred from class name
class Issue(IssueBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    updated_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    assignee_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", nullable=True, ondelete="SET NULL"
    )

    owner: User = Relationship(
        back_populates="issues",
        sa_relationship_kwargs={"foreign_keys": "Issue.owner_id"},
    )
    assignee: User | None = Relationship(
        back_populates="assigned_issues",
        sa_relationship_kwargs={"foreign_keys": "Issue.assignee_id"},
    )
    comments: list[Comment] = Relationship(back_populates="issue", cascade_delete=True)
    shares: list[IssueShare] = Relationship(back_populates="issue", cascade_delete=True)


# Properties to return via API, id is always required
class IssuePublic(IssueBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    owner_email: str
    assignee_id: uuid.UUID | None
    assignee_email: str | None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# Single-issue response, includes the current user's permissions on this issue
class IssueDetailPublic(IssuePublic):
    is_owner: bool
    can_edit_status: bool
    can_edit_assignee: bool


class IssuesPublic(SQLModel):
    data: list[IssuePublic]
    count: int


# Properties to receive on comment creation
class CommentCreate(SQLModel):
    content: str = Field(min_length=1, max_length=2000)


# Database model, database table inferred from class name
class Comment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    issue_id: uuid.UUID = Field(
        foreign_key="issue.id", nullable=False, ondelete="CASCADE"
    )
    author_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    content: str = Field(max_length=2000)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )

    issue: Issue = Relationship(back_populates="comments")
    author: User = Relationship()


class CommentPublic(SQLModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    author_id: uuid.UUID
    author_email: str
    content: str
    created_at: datetime | None = None


class CommentsPublic(SQLModel):
    data: list[CommentPublic]
    count: int


# Properties to receive when sharing an issue
class IssueShareCreate(SQLModel):
    email: EmailStr
    can_edit_status: bool = False
    can_edit_assignee: bool = False


# Database model, database table inferred from class name
class IssueShare(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("issue_id", "user_id", name="uq_issue_user_share"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    issue_id: uuid.UUID = Field(
        foreign_key="issue.id", nullable=False, ondelete="CASCADE"
    )
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    can_edit_status: bool = False
    can_edit_assignee: bool = False

    issue: Issue = Relationship(back_populates="shares")
    user: User = Relationship(back_populates="issue_shares")


class IssueSharePublic(SQLModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    user_id: uuid.UUID
    user_email: str
    can_edit_status: bool
    can_edit_assignee: bool


class IssueSharesPublic(SQLModel):
    data: list[IssueSharePublic]


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
