# Read-only integrations and data contracts

No external credentials are present in this repository. Accounts connected to ChatGPT are **not** automatically connected to this separately hosted application. Configure private environment variables on the app server; never paste credentials into source, tasks or customer messages.

## OpenAI draft assistance

Set `OPENAI_API_KEY` and a model identifier you have access to in `OPENAI_MODEL`. The server uses the Responses API with `store:false`, a bounded output limit and **no tools**. Do not infer provider retention policy from `store:false` alone. The Connect screen requires explicit consent before sending the selected task, its evidence and approved procedures to the model. Practice never uses a model. Shadow still works with deterministic reports/templates when model assistance is off; it is not presented as free-form AI reasoning.

`MAX_DAILY_AI_CALLS` defaults to 20 and is clamped to 1–100. Each attempted model request reserves a slot in SQLite before transmission; a failed or owner-aborted request still counts and may incur provider charges. Days reset in the America/New_York timezone. There is no automatic model retry, token-cost estimate or guaranteed spending ceiling in dollars. Source length and output are bounded; exact bills depend on the configured provider/model. API limits also apply.

Official reference: https://developers.openai.com/api/docs/guides/text

## Gmail

Create a Google OAuth **web application** with the Gmail API enabled. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_ORIGIN`, a strong `OWNER_PASSWORD`, and `INTEGRATION_ENCRYPTION_KEY` (base64 encoding of 32 random bytes). Use this exact callback:

```text
https://your-private-office-domain/api/oauth/gmail/callback
```

In Connect, select Shadow, resume the office and choose Connect read-only inbox. Complete the account consent flow in your browser. Only `https://www.googleapis.com/auth/gmail.readonly` is requested. OAuth uses session-bound expiring state and PKCE; the refresh token is encrypted with AES-256-GCM in the local database. No credential is returned through `/api/state` or the records export.

A manual import checks at most 10 messages matching `in:inbox newer_than:7d`; Gmail message IDs prevent repeat task creation. There is no background inbox polling. This is intentionally a bounded sample, **not** a complete inbox analysis. Only plain-text MIME parts or a Gmail-provided snippet are handled; attachments are ignored. HTML and email instructions are not executed. The app cannot send messages and does not request a send scope.

OAuth consent/testing restrictions, verification requirements, account permissions and token behavior must be checked with the actual Google project. Disconnect removes local access material; imported tasks remain for audit, and Google account consent is revoked separately.

Official references:
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list

## Friendly Party Rental order snapshot

The app does not guess a private endpoint on friendlypartyrental.com. Provide a narrowly scoped **read-only HTTPS JSON endpoint** in `FPR_READONLY_URL`; add `FPR_READONLY_TOKEN` only if the endpoint requires a bearer token. URLs must resolve to public IPv4 addresses and use port 443. Private-network hosts, redirects and arbitrary model-generated URLs are not allowed.

The endpoint returns the following structure. Fields that are absent remain unknown rather than fabricated:

```json
{
  "asOf": "2026-09-21T14:00:00.000Z",
  "orders": [
    {
      "id": "EXAMPLE-ONLY-001",
      "eventDate": "2026-09-25",
      "deliveryAddress": "Fictional venue address for a test record",
      "deliveryWindow": "12 pm–2 pm",
      "pickupWindow": "Next morning",
      "balanceDue": 0,
      "items": [
        {"name": "White folding chair", "quantity": 30, "availability": "confirmed"}
      ]
    }
  ]
}
```

Use current timestamps for real imports; the example timestamp is illustrative, not live evidence. At most 100 orders and 100 items per order are accepted. IDs must be unique; quantities are positive integers; availability is `confirmed`, `unconfirmed` or `unavailable`. Snapshot dates are required and future dates beyond the allowed clock-skew window are rejected. Records older than 24 hours are visibly flagged. The existing rental backend must be extended separately to emit this contract; no such backend edit was made by this project.

The Connect screen also accepts this JSON manually in Shadow. It is labeled an **owner import**, not a verified live read. Do not paste a full private database export. The checklist identifies missing details and uncertain availability; it does not reserve stock or certify a delivery can be fulfilled.

## Website

Set `ENABLE_WEBSITE_CHECKS=true` only to allow read-only checks of these fixed NY pages:

- `https://www.friendlypartyrental.com/`
- `https://www.friendlypartyrental.com/service-area`
- `https://www.friendlypartyrental.com/design-your-event`

The UI's check button reads the homepage. The allowlisted additional path can be supplied in an explicit owner task through the API. Reports cover HTTP status, a title/viewport check, image alt attributes and duplicate IDs in returned HTML. They do not run JavaScript, inspect screenshots, sign into customer accounts, test payments, fix code or publish deployments. Regex-based HTML checks are limited indicators, not full accessibility or SEO audits.

## GitHub

Set `GITHUB_READ_REPO=owner/repository` and `GITHUB_READ_TOKEN` with only the read permissions needed for repository commit/check metadata. This app adapter retrieves the latest commit and check runs. It never modifies files, executes code or deploys. Check-run metadata is not proof of a whole site's health. Token permissions and a real successful read need verification with the selected repository.

## Network and privacy controls

External requests have time and size limits. Public-address validation is pinned to the outgoing DNS lookup to avoid a validation/use mismatch. Redirects are not automatically followed. External content is untrusted source material, not authority to expand permissions. Selected content sent for model assistance can still contain customer information: connect only sources you are authorized to process and review provider/data retention obligations before enabling it.
