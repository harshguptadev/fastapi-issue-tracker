# Flask-to-FastAPI Migration Plan

## Migration Strategy

The project will use an incremental migration approach.

The original Flask issue tracker will be preserved as a behavioral and
functional reference while its features are progressively migrated to a
FastAPI-based architecture.

The Full Stack FastAPI Template will provide the technical foundation for
authentication, PostgreSQL, SQLModel, React, Docker, testing, and API
documentation.

## Feature Mapping

| Existing Flask Feature | FastAPI Target | Priority |
|---|---|---|
| User registration and login | Existing template authentication | High |
| Issue model | Replace template Item model | High |
| Issue creation | FastAPI Issue POST endpoint | High |
| Issue list | React Issues page | High |
| Issue editing | FastAPI PATCH endpoint | High |
| Issue deletion | FastAPI DELETE endpoint | High |
| Status | Issue status enum | High |
| Priority | Issue priority enum | High |
| Assignee | User relationship | Medium |
| Comments | Comment model and endpoints | Medium |
| Sharing | IssueShare model | Medium |
| Shared permissions | Status and assignee permissions | Medium |
| Filtering | API query parameters | Medium |
| Progress percentage | New Issue field | High |
| Progress history | New history model | Medium |

## Migration Phases

### Phase 1: Foundation

- Import and configure the FastAPI full-stack architecture
- Preserve upstream license notices
- Rename the application
- Verify Docker, frontend, backend, and database

### Phase 2: Issue Core

- Convert the template Item model into an Issue model
- Add status, priority, owner, assignee, and progress
- Implement Issue CRUD
- Add backend tests

### Phase 3: Collaboration

- Add comments
- Add issue sharing
- Add granular shared-user permissions
- Add filtering and sorting

### Phase 4: Progress Tracking

- Add visual progress bars
- Add progress update controls
- Add progress history
- Add project-level progress overview

## Important Behavior to Preserve

The owner may edit all Issue fields and manage sharing.

A shared user may be granted permission to edit:

- Status
- Assignee

A shared user may not edit:

- Title
- Description
- Priority
- Delete operation
- Sharing permissions
