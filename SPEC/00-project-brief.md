# Project Brief: Collega

## Purpose
Collega is a collaboration and project management tool for submitting, tracking, and improving process ideas.

## Product Model
The product is conceptually similar to Trello/Jira:
- Data is scoped to organizations.
- Organizations contain users, boards, statuses, and ideas.
- Boards organize ideas by workflow status using swimlanes.

## Technology Stack
- ASP.NET Core Web API
- Blazor
- Fluent UI
- Entity Framework Core
- PostgreSQL 16 (via Npgsql)

## Solution Structure
- `Collega.API` — HTTP API host
- `Collega.Application` — business logic and use-case orchestration
- `Collega.Domain` — entities, enums, value objects, shared contracts
- `Collega.Infrastructure` — persistence and external integrations
- `Collega.Client` — Blazor UI

## Architecture Rules
- API depends on Application.
- Application depends on Domain.
- Infrastructure implements abstractions from Application/Domain.
- Domain must not depend on API, Client, or Infrastructure.
- Business rules must not live in controllers or UI components.

## Dependency Policy
- Do not add new packages without approval.

## Coding Standards
- Follow official .NET coding guidelines:
  https://github.com/dotnet/runtime/tree/main/docs/coding-guidelines