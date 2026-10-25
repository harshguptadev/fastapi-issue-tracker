# Easy Tracker — AICTE Cross-Bureau Complaint Monitoring & Overlap System

> A centralized institution complaint monitoring, entity resolution, and human-in-the-loop overlap detection platform built with FastAPI, React, PostgreSQL, and Docker.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)

**Easy Tracker** (`fastapi-issue-tracker`) is a full-stack regulatory complaint management and cross-bureau coordination system engineered for technical institution governance (PGRC & Regulation Bureau).

## Core Capabilities

- **Consolidated Institutional Dossier:** Anchors every grievance and regulatory compliance matter to a verified **AICTE Permanent Institute ID (PID)** (`1-XXXXXXXXXX`).
- **3-Layer Overlap Detection Engine:**
  - **Layer 1 (Deterministic):** Exact AICTE PID and source case reference matching.
  - **Layer 2 (Fuzzy Heuristics):** Token-based and edit-distance normalization (`RapidFuzz`) for institute name and address variations.
  - **Layer 3 (Semantic Similarity):** Narrative similarity comparison to detect identical underlying allegations worded differently across bureaus.
- **Human-in-the-Loop (HITL) Review:** Surfaces explainable overlap alerts without auto-merging records; authorized bureau officers review and link related cases.
- **Cross-Bureau Collaboration & Permissions:** Fine-grained case sharing and status/assignee locks across PGRC and the Regulation Bureau.
- **Statutory SLA Calendar:** Tracks case deadlines, overdue matters, and inspection schedules on an interactive calendar.
- **Fast Bureau / Officer Account Switching:** Quickly switch between saved officer profiles (`PGRC`, `RB`, `Admin`) with color-coded bureau tags.

## Technology Stack

- **Backend:** FastAPI, Python, SQLModel, PostgreSQL 18, Alembic, Pydantic, RapidFuzz, JWT Auth
- **Frontend:** React, TypeScript, Vite, TanStack Router, Tailwind CSS / shadcn/ui
- **Infrastructure:** Docker Compose, Adminer, Pytest, Playwright

## Quick Start (Docker Compose)

```bash
cp .env.example .env
docker compose watch