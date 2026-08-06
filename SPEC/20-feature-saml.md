# Feature: SAML (Post-OAuth Phase)

## Outcome
Organizations can use SAML 2.0 single sign-on after OAuth stabilization.

## Scope
- In (post-OAuth phase): organization-scoped SAML configuration, metadata validation, assertion handling, user linking/provisioning reuse, and audit coverage.
- Out (MVP): SAML implementation is not part of MVP delivery.
- Out (initial SAML phase): IdP-initiated login, MFA policy orchestration, SCIM provisioning, and social identity providers.

## Requirements
1. SAML implementation is scheduled after Phase 2 OAuth completion.
2. SAML configuration is organization-scoped.
3. SP-initiated sign-in is the initial supported flow.
4. SAML must reuse the same external identity linking model as OAuth.
5. Local email/password login remains available during SAML rollout.
6. Existing users are linked first by external identity and then by email fallback.
7. Missing users can be auto-provisioned in the initiating organization with default role `User`.
8. Inactive users remain blocked from authentication.
9. SAML authentication and provisioning outcomes are audited.

## Acceptance Criteria
- [ ] SAML endpoints are not required for MVP release completion
- [ ] SAML is sequenced after OAuth implementation in roadmap and backlog artifacts
- [ ] SP-initiated flow works with organization-scoped configuration
- [ ] Linking and auto-provisioning behavior matches OAuth behavior
- [ ] Local login remains functional during SAML rollout
- [ ] Authentication and provisioning events generate audit records