# Collega Specifications

This directory contains the canonical product and delivery specifications for a fresh MVP implementation start.

## Canonical Spec Set

- `Specs Overview.md` (single-document AI entrypoint that aggregates canonical behavior)
- `10-requirements.md`
- `20-feature-*.md` Denotes an individual features for implementation
- `30-Contracts.md`
- `40-test-strategy.md`
- `50-technical-implementation-plan.md`
- `70-delivery-backlog.md`
- `80-workstream-roadmap.md`
- `85-implementation-timeline.md` (advisory effort/timeline estimates on top of the above; not canonical behavior)
- `90-definition-of-done.md`

## Working Rule

- Update these `SPEC/*.md` files first when implementation decisions change behavior.
- Treat the delivery and tracker documents as a reset baseline unless and until implementation progress is recorded again.

## Deterministic Sync Workflow

1. Edit canonical behavior in `SPEC/*.md`.
2. Validate internal canonical consistency across requirements, feature, contract, and test docs.

## AI Usage

- Start implementation work by reading `Specs Overview.md` for product behavior and `implementation-agent-tracker.md` for the reset execution baseline.
- For endpoint and payload details, use `30-Contracts.md` as the canonical source.
- For new client layout/interaction specs, start from `ui-ux-spec-template.md`.
