# Friendly Party Rental · Virtual Office

A working, owner-supervised 3D office for **Friendly Party Rental, Syracuse, New York**. Open the room, click a desk, inspect its recorded work and approve an exact draft. This is a **practice / read-only shadow release**, not an autonomous employee replacement.

## Apprenticeship release

The showroom now includes **Team case room**, **Riley · Phone apprentice**, **Email shadowing**, and **Learning review**. Authorized completed-call transcripts and Gmail conversations can become shared cases. Employees consult one another with a bounded, recorded review and one owner-approved draft. Continuous mailbox observation, saved drafts, automatic case reviews and phone bridge delivery start OFF. Real providers require separate private configuration and consent; no customer sends or live call recording were enabled. Read [Apprenticeship](docs/APPRENTICESHIP.md) for operation, privacy, exact bridge contracts and remaining live-verification limits.

## Start the office

Use **Node.js 22.13+ or Node.js 24**. There are no npm runtime dependencies. `npm start` runs the required local asset build automatically; no package-install step is required.

```bash
git clone https://github.com/customerservice-prog/Virtual---Friendly-Party-Rental-Office.git
cd Virtual---Friendly-Party-Rental-Office
npm start
```

Open **http://127.0.0.1:3000** and click **Start practice shift**. Three fictional tasks run locally without a model key or external access. Click Morgan, Avery or Alex to review the work. Local unauthenticated practice binds only to loopback. Never expose that mode through a tunnel or reverse proxy.

## What is built

**3D headquarters.** A furnished cutaway office, three seated employee avatars, Bryan's owner desk, monitors, sample shelving, lounge and company sign. Rotate and zoom the room; switch between overview, owner's chair and top view. Status labels come from stored task state. Characters animate work only while a task is actually running. WebGL rendering has a depth-buffered software 3D fallback. The ordinary team cards remain usable without canvas support.

**Three supervised roles.** Morgan prepares order-readiness checklists. Avery triages imported email and prepares reply drafts. Alex prepares limited HTTP/HTML issue reports and configured repository check summaries. In practice these are explicitly labeled local templates and deterministic checks, not model calls. In shadow, optional model assistance can refine a draft after explicit consent.

**Owner controls.** Shared task board, role filtering, per-task original input and evidence, recorded activity, editable drafts, revision-checked approvals, request-changes/retry/cancel, identity-preserving handoffs, employee pause and global pause. A new task never becomes an email, payment, reservation or production change. Approval records the exact reviewed content as **approved — not sent**.

**Durable records.** SQLite stores tasks, event entries, approved draft content, procedures, usage limits and owner sessions. Interrupted work becomes visibly blocked on restart. Queue claims and revision checks prevent two workers or two owner windows from silently processing the same task version. One-off draft edits do not become company policy; procedures need a separate explicit approval.

**Optional read-only connections.** Gmail OAuth, an explicitly configured NY rental-record snapshot, fixed Friendly Party Rental website pages, and one GitHub repository's commit/check metadata. Connections begin unconfigured. ChatGPT's connected accounts do not automatically grant this separate app access. Configuration, consent and successful reads are distinct states in the UI.

## Modes and boundaries

| Mode | What runs | External effects |
| --- | --- | --- |
| Practice | Fictional scenarios, local templates and checks | No model calls or live reads |
| Shadow | Owner-requested authorized reads, drafts and reports | Read-only providers; optional explicitly enabled model requests |
| Autonomous | **Not implemented or selectable** | No sending, order changes, charging, refunds, code execution or deployments |

The 3D work screen is a view of tasks, drafts, evidence and events. It is **not** a remote desktop stream, hidden model reasoning, or employees independently using a browser. No fabricated productivity, hours-saved or replacement scores are displayed.

## Private hosting and live source setup

See **[Deployment](docs/DEPLOYMENT.md)** before hosting and **[Integration contracts](docs/INTEGRATIONS.md)** before using real data. A Dockerfile and Railway configuration are included, but configuration files alone do not mean an app has been deployed.

For a private office, copy `.env.example` to `.env`, set a unique `OWNER_PASSWORD` and configure only the sources needed. Production refuses to start without an owner password of at least 16 characters and an exact HTTPS `PUBLIC_ORIGIN`. Never put passwords, tokens, `.env` files, database files or customer records into this public repository.

## Verification

```bash
npm run check
npm test
```

The test suite covers task state, approvals, pause and abort behavior, restart recovery, Gmail deduplication, data validation, request limits, mocked model use, authentication, origin/CSRF enforcement and actual HTTP/SSE behavior. **[QA report](docs/QA.md)** separates local verification from external integrations and hosting that still require live testing.

## Repository map

```text
server.mjs              HTTP, authentication, CSRF, API and SSE
lib/store.mjs           SQLite state, approvals, procedures and audit entries
lib/engine.mjs          Role workers, practice scenarios and read-only workflows
lib/integrations.mjs    Bounded adapters, OAuth, secret encryption and model budget
public/scene.js         Dependency-free 3D geometry and WebGL/software rendering
public/app.js           Owner controls and evidence/work inspection
public/style.css        Responsive desktop and mobile interface
public/index.html       Accessible application shell
tests/                 Automated backend and browser checks
docs/                  Hosting, integration contracts, security and QA
```

## Current limits

Single owner, one application process and one persistent SQLite volume. No production code-fixing loop. The new explicitly enabled apprenticeship observer can poll the authorized mailbox every 60 seconds; the legacy manual inbox importer below is separate. Imported Gmail content is plain text or a provider snippet; attachments and full HTML email understanding are not implemented. Snapshot reports cannot prove current availability when the source is stale or incomplete. Static HTML checks are not visual browser QA. The UI/export show up to 300 recent tasks and 120 recent global events; the database retains the stored event log and accepted-draft history. Retry/handoff clears the previous unapproved draft and evidence; it is not full version-history storage. Back up the database separately.

Live OAuth/model/provider access, hardware WebGL, hosting and restoration of production backups must be verified in the intended environment. See [Security](SECURITY.md).
