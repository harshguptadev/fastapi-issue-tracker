import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.crud import get_user_by_email
from tests.utils.issue import create_random_issue
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import random_email


def _create_user_and_headers(
    client: TestClient, db: Session
) -> tuple[str, dict[str, str]]:
    email = random_email()
    headers = authentication_token_from_email(client=client, email=email, db=db)
    return email, headers


def _create_issue(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
        f"{settings.API_V1_STR}/issues/",
        headers=headers,
        json={"title": "Shared issue"},
    )
    assert response.status_code == 200
    return response.json()["id"]


def test_owner_can_share_list_and_revoke(client: TestClient, db: Session) -> None:
    owner_email, owner_headers = _create_user_and_headers(client, db)
    shared_email, _ = _create_user_and_headers(client, db)
    issue_id = _create_issue(client, owner_headers)

    share_response = client.post(
        f"{settings.API_V1_STR}/issues/{issue_id}/shares",
        headers=owner_headers,
        json={"email": shared_email, "can_edit_status": True},
    )
    assert share_response.status_code == 200
    share = share_response.json()
    assert share["user_email"] == shared_email
    assert share["can_edit_status"] is True
    assert share["can_edit_assignee"] is False

    list_response = client.get(
        f"{settings.API_V1_STR}/issues/{issue_id}/shares",
        headers=owner_headers,
    )
    assert list_response.status_code == 200
    assert any(s["user_email"] == shared_email for s in list_response.json()["data"])

    shared_user = get_user_by_email(session=db, email=shared_email)
    revoke_response = client.delete(
        f"{settings.API_V1_STR}/issues/{issue_id}/shares/{shared_user.id}",
        headers=owner_headers,
    )
    assert revoke_response.status_code == 200

    list_after_revoke = client.get(
        f"{settings.API_V1_STR}/issues/{issue_id}/shares",
        headers=owner_headers,
    )
    assert not any(
        s["user_email"] == shared_email for s in list_after_revoke.json()["data"]
    )


def test_non_owner_cannot_share_or_list_shares(
    client: TestClient, db: Session
) -> None:
    issue = create_random_issue(db)
    _, other_headers = _create_user_and_headers(client, db)

    share_response = client.post(
        f"{settings.API_V1_STR}/issues/{issue.id}/shares",
        headers=other_headers,
        json={"email": "someone@example.com"},
    )
    assert share_response.status_code == 403

    list_response = client.get(
        f"{settings.API_V1_STR}/issues/{issue.id}/shares",
        headers=other_headers,
    )
    assert list_response.status_code == 403


def test_share_unknown_email_returns_404(
    client: TestClient, db: Session
) -> None:
    owner_email, owner_headers = _create_user_and_headers(client, db)
    issue_id = _create_issue(client, owner_headers)

    response = client.post(
        f"{settings.API_V1_STR}/issues/{issue_id}/shares",
        headers=owner_headers,
        json={"email": "nobody-here@example.com"},
    )
    assert response.status_code == 404


def test_shared_user_with_can_edit_status_can_only_change_status(
    client: TestClient, db: Session
) -> None:
    owner_email, owner_headers = _create_user_and_headers(client, db)
    shared_email, shared_headers = _create_user_and_headers(client, db)
    issue_id = _create_issue(client, owner_headers)

    client.post(
        f"{settings.API_V1_STR}/issues/{issue_id}/shares",
        headers=owner_headers,
        json={"email": shared_email, "can_edit_status": True},
    )

    status_update = client.put(
        f"{settings.API_V1_STR}/issues/{issue_id}",
        headers=shared_headers,
        json={"status": "In Progress"},
    )
    assert status_update.status_code == 200
    assert status_update.json()["status"] == "In Progress"

    forbidden_update = client.put(
        f"{settings.API_V1_STR}/issues/{issue_id}",
        headers=shared_headers,
        json={"title": "Hijacked title"},
    )
    assert forbidden_update.status_code == 403


def test_shared_user_with_can_edit_assignee_can_only_change_assignee(
    client: TestClient, db: Session
) -> None:
    owner_email, owner_headers = _create_user_and_headers(client, db)
    shared_email, shared_headers = _create_user_and_headers(client, db)
    assignee_email, _ = _create_user_and_headers(client, db)
    assignee = get_user_by_email(session=db, email=assignee_email)
    issue_id = _create_issue(client, owner_headers)

    client.post(
        f"{settings.API_V1_STR}/issues/{issue_id}/shares",
        headers=owner_headers,
        json={"email": shared_email, "can_edit_assignee": True},
    )

    assignee_update = client.put(
        f"{settings.API_V1_STR}/issues/{issue_id}",
        headers=shared_headers,
        json={"assignee_id": str(assignee.id)},
    )
    assert assignee_update.status_code == 200
    assert assignee_update.json()["assignee_id"] == str(assignee.id)

    forbidden_status_update = client.put(
        f"{settings.API_V1_STR}/issues/{issue_id}",
        headers=shared_headers,
        json={"status": "Done"},
    )
    assert forbidden_status_update.status_code == 403


def test_shared_user_without_permissions_cannot_update(
    client: TestClient, db: Session
) -> None:
    owner_email, owner_headers = _create_user_and_headers(client, db)
    shared_email, shared_headers = _create_user_and_headers(client, db)
    issue_id = _create_issue(client, owner_headers)

    client.post(
        f"{settings.API_V1_STR}/issues/{issue_id}/shares",
        headers=owner_headers,
        json={"email": shared_email},
    )

    response = client.put(
        f"{settings.API_V1_STR}/issues/{issue_id}",
        headers=shared_headers,
        json={"status": "Done"},
    )
    assert response.status_code == 403


def test_shared_user_cannot_delete_issue(client: TestClient, db: Session) -> None:
    owner_email, owner_headers = _create_user_and_headers(client, db)
    shared_email, shared_headers = _create_user_and_headers(client, db)
    issue_id = _create_issue(client, owner_headers)

    client.post(
        f"{settings.API_V1_STR}/issues/{issue_id}/shares",
        headers=owner_headers,
        json={"email": shared_email, "can_edit_status": True, "can_edit_assignee": True},
    )

    response = client.delete(
        f"{settings.API_V1_STR}/issues/{issue_id}",
        headers=shared_headers,
    )
    assert response.status_code == 403


def test_non_shared_user_gets_403_on_issue(client: TestClient, db: Session) -> None:
    issue = create_random_issue(db)
    _, other_headers = _create_user_and_headers(client, db)

    response = client.get(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=other_headers,
    )
    assert response.status_code == 403


def test_nonexistent_issue_gets_404_on_shares(
    client: TestClient, db: Session
) -> None:
    _, owner_headers = _create_user_and_headers(client, db)
    response = client.get(
        f"{settings.API_V1_STR}/issues/{uuid.uuid4()}/shares",
        headers=owner_headers,
    )
    assert response.status_code == 404
