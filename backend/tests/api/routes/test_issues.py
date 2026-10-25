import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import Issue, IssueShare
from tests.utils.issue import create_random_issue
from tests.utils.user import create_random_user


def test_create_issue(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"title": "Foo", "description": "Fighters"}
    response = client.post(
        f"{settings.API_V1_STR}/issues/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["description"] == data["description"]
    assert content["status"] == "Open"
    assert content["priority"] == 3
    assert "id" in content
    assert "owner_id" in content


def test_create_issue_with_status_priority_assignee(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    assignee = create_random_user(db)
    data = {
        "title": "Foo",
        "status": "In Progress",
        "priority": 1,
        "assignee_id": str(assignee.id),
    }
    response = client.post(
        f"{settings.API_V1_STR}/issues/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["status"] == "In Progress"
    assert content["priority"] == 1
    assert content["assignee_id"] == str(assignee.id)


def test_create_issue_with_due_date(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "title": "Issue with due date",
        "description": "Calendar test issue",
        "due_date": "2026-08-10",
    }
    response = client.post(
        f"{settings.API_V1_STR}/issues/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["due_date"] == data["due_date"]


def test_create_issue_without_due_date(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "title": "Issue without due date",
        "description": "No deadline",
    }
    response = client.post(
        f"{settings.API_V1_STR}/issues/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["due_date"] is None


def test_read_issue(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    issue = create_random_issue(db)
    response = client.get(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == issue.title
    assert content["description"] == issue.description
    assert content["id"] == str(issue.id)
    assert content["owner_id"] == str(issue.owner_id)
    assert content["is_owner"] is True
    assert content["can_edit_status"] is True
    assert content["can_edit_assignee"] is True


def test_read_issue_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/issues/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Issue not found"


def test_read_issue_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    issue = create_random_issue(db)
    response = client.get(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
    content = response.json()
    assert content["detail"] == "Not enough permissions"


def test_read_issues(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_issue(db)
    create_random_issue(db)
    response = client.get(
        f"{settings.API_V1_STR}/issues/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 2


def test_read_issues_filters_by_status_and_priority(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    issue = create_random_issue(db)
    client.put(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=superuser_token_headers,
        json={"status": "Done", "priority": 5},
    )

    response = client.get(
        f"{settings.API_V1_STR}/issues/",
        headers=superuser_token_headers,
        params={"status": "Done", "priority": 5},
    )
    assert response.status_code == 200
    content = response.json()
    assert any(item["id"] == str(issue.id) for item in content["data"])
    assert all(item["status"] == "Done" for item in content["data"])
    assert all(item["priority"] == 5 for item in content["data"])


def test_read_issues_only_shows_owned_and_shared_for_normal_user(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    other_users_issue = create_random_issue(db)
    response = client.get(
        f"{settings.API_V1_STR}/issues/",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    returned_ids = {item["id"] for item in content["data"]}
    assert str(other_users_issue.id) not in returned_ids


def test_read_calendar_issues_filters_by_due_date_range(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    before_range = create_random_issue(db)
    before_range.due_date = date(2026, 7, 31)

    start_boundary = create_random_issue(db)
    start_boundary.due_date = date(2026, 8, 1)

    inside_range = create_random_issue(db)
    inside_range.due_date = date(2026, 8, 15)

    end_boundary = create_random_issue(db)
    end_boundary.due_date = date(2026, 8, 31)

    after_range = create_random_issue(db)
    after_range.due_date = date(2026, 9, 1)

    without_due_date = create_random_issue(db)
    without_due_date.due_date = None

    db.add_all(
        [
            before_range,
            start_boundary,
            inside_range,
            end_boundary,
            after_range,
            without_due_date,
        ]
    )
    db.commit()

    response = client.get(
        f"{settings.API_V1_STR}/issues/calendar",
        headers=superuser_token_headers,
        params={"start": "2026-08-01", "end": "2026-08-31"},
    )

    assert response.status_code == 200
    content = response.json()
    returned_ids = {item["id"] for item in content["data"]}

    assert str(start_boundary.id) in returned_ids
    assert str(inside_range.id) in returned_ids
    assert str(end_boundary.id) in returned_ids

    assert str(before_range.id) not in returned_ids
    assert str(after_range.id) not in returned_ids
    assert str(without_due_date.id) not in returned_ids

    assert content["count"] == len(content["data"])
    assert all(item["due_date"] is not None for item in content["data"])


def test_read_calendar_issues_only_shows_visible_issues(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    normal_user = crud.get_user_by_email(
        session=db,
        email=settings.EMAIL_TEST_USER,
    )
    assert normal_user is not None

    other_owner = create_random_user(db)

    owned_issue = Issue(
        title="Owned calendar issue",
        owner_id=normal_user.id,
        due_date=date(2026, 8, 10),
    )

    shared_issue = Issue(
        title="Shared calendar issue",
        owner_id=other_owner.id,
        due_date=date(2026, 8, 15),
    )

    hidden_issue = Issue(
        title="Hidden calendar issue",
        owner_id=other_owner.id,
        due_date=date(2026, 8, 20),
    )

    db.add_all([owned_issue, shared_issue, hidden_issue])
    db.commit()
    db.refresh(owned_issue)
    db.refresh(shared_issue)
    db.refresh(hidden_issue)

    share = IssueShare(
        issue_id=shared_issue.id,
        user_id=normal_user.id,
    )
    db.add(share)
    db.commit()

    response = client.get(
        f"{settings.API_V1_STR}/issues/calendar",
        headers=normal_user_token_headers,
        params={"start": "2026-08-01", "end": "2026-08-31"},
    )

    assert response.status_code == 200
    content = response.json()
    returned_ids = {item["id"] for item in content["data"]}

    assert str(owned_issue.id) in returned_ids
    assert str(shared_issue.id) in returned_ids
    assert str(hidden_issue.id) not in returned_ids


def test_read_calendar_issues_rejects_invalid_date_range(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/issues/calendar",
        headers=superuser_token_headers,
        params={"start": "2026-08-31", "end": "2026-08-01"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Start date must be on or before end date"


def test_update_issue(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    issue = create_random_issue(db)
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["description"] == data["description"]
    assert content["id"] == str(issue.id)
    assert content["owner_id"] == str(issue.owner_id)


def test_update_issue_due_date(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    issue = create_random_issue(db)
    data = {"due_date": "2026-08-15"}

    response = client.put(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=superuser_token_headers,
        json=data,
    )

    assert response.status_code == 200
    content = response.json()
    assert content["due_date"] == data["due_date"]
    assert content["id"] == str(issue.id)


def test_clear_issue_due_date(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    issue = create_random_issue(db)

    set_response = client.put(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=superuser_token_headers,
        json={"due_date": "2026-08-15"},
    )
    assert set_response.status_code == 200
    assert set_response.json()["due_date"] == "2026-08-15"

    clear_response = client.put(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=superuser_token_headers,
        json={"due_date": None},
    )

    assert clear_response.status_code == 200
    content = clear_response.json()
    assert content["due_date"] is None
    assert content["id"] == str(issue.id)


def test_update_issue_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_V1_STR}/issues/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Issue not found"


def test_update_issue_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    issue = create_random_issue(db)
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=normal_user_token_headers,
        json=data,
    )
    assert response.status_code == 403


def test_delete_issue(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    issue = create_random_issue(db)
    response = client.delete(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Issue deleted successfully"


def test_delete_issue_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.delete(
        f"{settings.API_V1_STR}/issues/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Issue not found"


def test_delete_issue_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    issue = create_random_issue(db)
    response = client.delete(
        f"{settings.API_V1_STR}/issues/{issue.id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
