# Feature: OAuth (Phase 2, Post-MVP)

## Outcome
Organizations can enable Microsoft Entra ID sign-in while preserving existing local login behavior.

## Scope
- In (Phase 2): Microsoft Entra ID OAuth/OIDC integration, organization-scoped SSO configuration, callback handling, user linking/provisioning, and audit coverage.
- Out (MVP): OAuth/OIDC implementation is not part of MVP delivery.
- Out (Phase 2): SAML, MFA, social login providers, SCIM provisioning, and external logout propagation.

## Requirements
1. OAuth implementation is delivered in Phase 2 after MVP release.
2. Phase 2 provider target is Microsoft Entra ID.
3. Organizations must use organization-scoped sign-in entry points to initiate OAuth.
4. Local email/password login remains supported for coexistence and break-glass access.
5. Users are linked first by stored external identity mapping.
6. If no mapping exists, users are matched by globally unique email.
7. If no user exists, auto-provisioning creates a user in the initiating organization with default role `User`.
8. Inactive users remain blocked from authentication.
9. OAuth success and failure outcomes and provisioning events are audited.
10. OAuth configuration must not weaken global email uniqueness rules.

## Account-Link and Claim-Mapping Edge Cases (Resolved)
1. Linking precedence is strict: external identity mapping by provider + subject (`sub`) is evaluated before email fallback.
2. Email fallback matching is case-insensitive and requires a verified email claim.
3. If required claims (`sub`, `email`, `email_verified`) are missing, authentication is denied with a contract-aligned error.
4. If a subject mapping exists but callback email maps to a different local account, authentication is denied and an audit conflict event is emitted.
5. If no subject mapping exists and the verified email belongs to a user in a different organization than the initiating organization, authentication is denied and no auto-provision occurs.
6. Auto-provision occurs only when no subject mapping exists, no local email match exists, and required claims are present.
7. Auto-provisioned users are created in the initiating organization with default role `User`.
8. Name claims (`given_name`, `family_name`) are optional; missing names are allowed and can be completed later by user or admin.
9. Any ambiguous identity condition (multiple candidate local users for a normalized email) is treated as a hard deny and audited.

## Acceptance Criteria
- [ ] OAuth endpoints and callbacks are not required for MVP release completion
- [ ] Microsoft Entra ID sign-in works in Phase 2 using organization-scoped entry points
- [ ] Local login continues to work when OAuth is enabled
- [ ] Existing users can be linked by external identity and by email fallback
- [ ] Missing users can be auto-provisioned with default role `User`
- [ ] Inactive users are denied authentication
- [ ] OAuth outcomes and provisioning actions generate audit events
- [ ] Callback requests with missing required claims are denied with contract-aligned failures
- [ ] Subject-mapping and email-fallback conflicts are denied and audited
- [ ] Cross-organization fallback email matches are denied and do not auto-provision
- [ ] Ambiguous fallback identity matches are denied and audited