# Security boundaries

This is a supervised single-owner release, not a security certification. Do not expose it publicly without production configuration and a reviewed hosting setup.

- No real email sending, payment, refund, order mutation, shell execution or deployment endpoints exist.
- Practice uses fictional data. Shadow reads only explicitly configured sources. There is no autonomous execution mode.
- Production requires a strong owner password and an exact HTTPS origin. Password comparison uses scrypt; cookie tokens are random and only their hashes are stored. All mutations require a valid session, expected origin and CSRF token. Login attempts and mutations are rate limited.
- OAuth is read-only, session-bound and expiring. Stored refresh tokens use AES-256-GCM with a server-only key. Secrets are not included in state, logs intentionally emitted by this app, or export responses.
- Do not commit `.env`, tokens, database files, logs containing customer data, backups or credentials. Do not put secrets in task instructions; task inputs and approved drafts are business records.
- Untrusted source text is escaped in the interface and treated as data by the model prompt. Prompts alone are not a security boundary: the model has no executable tools and this release has no business-write adapter.
- Global pause aborts active read/model requests and prevents new work. A request already received by a provider cannot be retracted; charges can still apply. Imported tasks created before an abort can remain for review.
- Browser rendering, animation and status labels cannot authorize an action. Approval is checked server-side against an exact task revision and persisted draft.

## Operational limitations

One process and one SQLite volume; no multi-tenant access, staff roles, MFA, account recovery, public signup or SSO. A strong shared owner login is not a substitute for a broader access-control review. Consider a private network/access proxy with MFA before production, and test origin/cookie/streaming behavior with that proxy.

The app's events and approvals are local audit records, not cryptographically tamper-evident logs. An administrator with filesystem/database access can alter them. Configure appropriate host access, encryption at rest, retention and backup policies. No automatic deletion/retention schedule is implemented. Disconnecting a source does not erase imported tasks.

The UI/export are bounded recent-record views rather than a complete backup. Unapproved draft/evidence snapshots are not retained after retry/handoff. Do not describe this release as full version-history storage.

Report security concerns privately to the repository owner rather than posting tokens or real customer records in a public issue. Live providers, TLS, persistent storage, access-proxy behavior and backup restoration require deployment-specific verification.
