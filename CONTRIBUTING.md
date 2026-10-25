# Contributing to Easy Tracker

Thank you for your interest in contributing to Easy Tracker.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

1. Clone the repository:

   ```bash
   git clone https://github.com/FastIssue-Team/fastapi-issue-tracker.git
   cd fastapi-issue-tracker
   cp .env.example .env
   ```

2. Edit `.env` and set at least `SECRET_KEY`, `FIRST_SUPERUSER`, and `FIRST_SUPERUSER_PASSWORD`.

3. Start the full stack with Docker Compose:

   ```bash
   docker compose watch
   ```

4. Open the app at `http://localhost:5173` and the API docs at `http://localhost:8000/docs`.

For more detail (running backend or frontend outside Docker, linting, pre-commit, and client generation), see [development.md](development.md). That guide is the full onboarding reference; this document covers contribution expectations and the short setup path above.

## Running tests

Backend:

```bash
cd backend
uv run pytest
```

Frontend end-to-end tests:

```bash
cd frontend
bun run test
```

Run formatting and quality checks from the repository root as described in [development.md](development.md) before opening a pull request.

## Contribution workflow

1. Open or select a [GitHub Issue](https://github.com/FastIssue-Team/fastapi-issue-tracker/issues) that describes the work.
2. Create a focused feature branch from `main`.
3. Implement the change and add tests for new or changed behavior.
4. Run the relevant checks locally.
5. Open a pull request with a clear description. Include screenshots for UI changes.
6. Keep pull requests focused on a single change when possible.

For large features or architectural proposals, open an issue first so the team can agree on scope and design before implementation.

## Multi-account switching changes

If your change touches account switching:

1. After switching accounts, verify that data from the previous account is cleared before loading data for the newly active account (issues, calendar, profile, and other authenticated views).
2. Do not use color as the only way to identify an account or application state. Labels, email, and other text cues should remain available.

## Questions

If something in the docs is unclear, open an issue on the repository and we will help.
