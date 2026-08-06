# UI/UX Spec Template

## 1. Metadata
- Feature:
- Screen or Workflow:
- Status: Draft | Ready for Review | Approved
- Last Updated:
- Owner:
- Related Specs:
  - SPEC/10-requirements.md
  - SPEC/20-feature-<feature>.md
  - SPEC/30-Contracts.md
  - SPEC/40-test-strategy.md
- Related Mockup Files:
- Related API Endpoints:

## 2. Purpose and Outcome
Describe the user outcome this screen or workflow must deliver.

## 3. Scope
### In Scope
- 

### Out of Scope
- 

## 4. Roles and Access
| Role | Can View | Can Act | Restricted Actions |
|---|---|---|---|
| Site Admin |  |  |  |
| Org Admin |  |  |  |
| User |  |  |  |
| Read Only |  |  |  |

## 5. Layout Contract
### Desktop Layout
- Region A (header):
- Region B (navigation):
- Region C (primary content):
- Region D (secondary panel):

### Mobile Layout
- Breakpoint(s):
    XLG, XL, Medium
- Stacking behavior:
- Priority content preserved:

### Component Structure
- Component:
  - Responsibility:
  - Inputs:
  - Outputs:

## 6. State Matrix
| State | Trigger | Visible UI | Enabled Actions | Disabled Actions | Message/Feedback | Recovery Path |
|---|---|---|---|---|---|---|
| Loading |  |  |  |  |  |  |
| Empty |  |  |  |  |  |  |
| Populated |  |  |  |  |  |  |
| Validation Error |  |  |  |  |  |  |
| Unauthorized/Forbidden |  |  |  |  |  |  |
| Server Error |  |  |  |  |  |  |

## 7. Interaction Flows
### Flow A: Primary Path
1. User action:
2. Client validation:
3. API call:
4. Success feedback:
5. Post-success focus or navigation:

### Flow B: Failure Path
1. Failure trigger:
2. Error display:
3. Retry or recovery action:

## 8. Form and Field Rules
| Field | Required | Type | Constraints | Inline Validation | Submit Validation |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## 9. Behavior Rules
- Rule 1:
- Rule 2:
- Rule 3:

For each rule, include:
- Trigger condition
- Expected UI behavior
- Expected API/system behavior

## 10. Accessibility Requirements
- Keyboard navigation order:
- Initial focus behavior:
- Focus after submit/save/error:
- Screen reader announcements:
- Contrast/visibility constraints:
- Non-color feedback requirement:

## 11. Content and Microcopy
- Button labels:
- Empty-state copy:
- Validation messages:
- Error messages:
- Success toasts or confirmations:

## 12. Telemetry and Diagnostics
| Event Name | Trigger | Required Properties | Purpose |
|---|---|---|---|
|  |  |  |  |

## 13. Test Mapping
| UI Requirement | Unit Test Target | Integration Test Target | E2E Test Target |
|---|---|---|---|
|  |  |  |  |

## 14. Acceptance Criteria
- [ ]
- [ ]
- [ ]

## 15. Open Questions
- 

## 16. Drift and Change Control
- Canonical-first policy: update SPEC root behavior docs first.
- Keep this UI/UX spec aligned with contracts and tests.
- When behavior changes, update related mockups and verification coverage.

## Authoring Notes
- Keep requirements observable and testable.
- Define blocked actions explicitly, not only allowed actions.
- Specify empty-state guidance and recovery actions.
- Do not encode backend-only business logic in UI responsibilities.
