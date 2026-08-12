# Historical Bug Log

This file is retained as completed history. Use `Bug Triage.md` as the authoritative active queue, and move newly verified fixes from its `TODO` section to its `COMPLETED` section.

- [x] Password validation requires at least 6 characters, lowercase and uppercase letters, a number, and a symbol; validation errors identify each missing requirement.
- [x] The landing page after login defaults to the Dashboard at `/`.
- [x] Session resume validates the stored token with the API and clears rejected tokens before returning to `/login`.
- [x] The redundant password update required text is removed.
