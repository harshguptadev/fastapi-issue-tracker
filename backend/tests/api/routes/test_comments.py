from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.issue import create_random_issue
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import random_email, random_lower_string


def _create_user_and_headers(
    client: TestClient, db: Session
) -> tuple[str, dict[str, str]]:
    email = random_email()
    headers = authentication_token_from_email(client=client, email=email, db=db)
    return email, headers


def test_add_and_list_comments_as_owner(client: TestClient, db: Session) -> None:
    owner_email, owner_headers = _create_user_and_headers(client, db)
    create_response = client.post(
        f"{settings.API_V1_STR}/issues/",
        headers=owner_headers,
        json={"title": "Owner issue"},
    )
    issue_id = create_response.json()["id"]

    content = random_lower_string()
    response = client.post(
        f"{settings.API_V1_STR}/issues/{issue_id}/comments",
        headers=owner_headers,
        json={"content": content},
    )
    assert response.status_code == 200
    comment = response.json()
    assert comment["content"] == content
    assert comment["author_email"] == owner_email
    assert comment["issue_id"] == issue_id

    list_response = client.get(
        f"{settings.API_V1_STR}/issues/{issue_id}/comments",
        headers=owner_headers,
    )
    assert list_response.status_code == 200
    data = list_response.json()["data"]
    assert any(c["content"] == content for c in data)


def test_shared_user_can_view_and_add_comments(client: TestClient, db: Session) -> None:
    owner_email, owner_headers = _create_user_and_headers(client, db)
    shared_email, shared_headers = _create_user_and_headers(client, db)

    create_response = client.post(
        f"{settings.API_V1_STR}/issues/",
        headers=owner_headers,
        json={"title": "Shared issue"},
    )
    issue_id = create_response.json()["id"]

    share_response = client.post(
        f"{settings.API_V1_STR}/issues/{issue_id}/shares",
        headers=owner_headers,
        json={"email": shared_email},
    )
    assert share_response.status_code == 200

    content = random_lower_string()
    add_response = client.post(
        f"{settings.API_V1_STR}/issues/{issue_id}/comments",
        headers=shared_headers,
        json={"content": content},
    )
    assert add_response.status_code == 200
    assert add_response.json()["author_email"] == shared_email

    list_response = client.get(
        f"{settings.API_V1_STR}/issues/{issue_id}/comments",
        headers=shared_headers,
    )
    assert list_response.status_code == 200
    assert any(c["content"] == content for c in list_response.json()["data"])


def test_unrelated_user_cannot_view_or_add_comments(
    client: TestClient, db: Session
) -> None:
    issue = create_random_issue(db)
    _, other_headers = _create_user_and_headers(client, db)

    list_response = client.get(
        f"{settings.API_V1_STR}/issues/{issue.id}/comments",
        headers=other_headers,
    )
    assert list_response.status_code == 403

    add_response = client.post(
        f"{settings.API_V1_STR}/issues/{issue.id}/comments",
        headers=other_headers,
        json={"content": "hi"},
    )
    assert add_response.status_code == 403
