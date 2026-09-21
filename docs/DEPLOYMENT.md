# Hosting the private office

This repository is separate from both rental websites and does not deploy changes to either one.

## One-process deployment

The server and worker share SQLite. Run exactly **one replica** with a persistent volume. Do not use an ephemeral filesystem for real work and do not horizontally scale this release. The Dockerfile uses Node 24 and an unprivileged `node` user. Mount a writable directory at `/app/data` (or change `DATA_DIR` to the mount path).

Required private-hosting variables:

```dotenv
NODE_ENV=production
OWNER_PASSWORD=<unique strong password, at least 16 characters>
PUBLIC_ORIGIN=https://your-private-office-domain
DATA_DIR=/app/data
```

Keep `PUBLIC_ORIGIN` exact: no path or trailing slash. The HTTPS reverse proxy must forward streaming responses from `/api/events` without buffering and use the app's dynamic `PORT`. Do not expose the Node port directly on public HTTP. The app does not trust proxy headers for login rate-limit identity; a shared proxy can therefore share the login attempt limit.

The health endpoint is `/healthz`; it reveals no task or credential data. The root shell is public but every task/record API requires the owner session when `OWNER_PASSWORD` is configured. Cookies are HTTP-only, SameSite Lax and Secure in production, with an eight-hour session lifetime.

## Railway

Create a **separate** Railway service from this repository, not inside or as a replacement for the NY or SC rental app service. The included `railway.json` selects the Dockerfile, health check and one replica. Create a persistent volume, configure its writable mount and set `DATA_DIR` accordingly. Ensure the unprivileged Node user can write the mounted directory before activation. Configure the service's generated/custom HTTPS domain as `PUBLIC_ORIGIN`; set the owner password in Railway variables, never in GitHub. A real deployment and volume permissions still require a hosting test.

Do not connect any live integration until private login, TLS, persistence, owner pause and restart behavior have been verified on the hosted URL. Then use the Connect screen, choose Shadow and resume the office. All business writes remain disabled in this version.

## Backups and upgrades

Pause the office, wait for or cancel outstanding requests and stop the process before making a simple filesystem backup. Back up the entire data directory consistently (including any SQLite WAL/SHM files); do not copy only an active database file. Alternatively, use a SQLite-aware backup mechanism. Protect backups as customer data. Store `INTEGRATION_ENCRYPTION_KEY` separately from the backup and do not rotate it without planning token migration/reconnection.

Before an upgrade, take a backup and test on a separate copy. After restart, unfinished runs should appear blocked, approved drafts should still be present, and a sample task should require a new owner review. Perform an actual restore rehearsal before relying on production backups. The app's JSON export is a recent-records export, not a full restorable database backup.

## Rollback

Pause, stop the app, return to the previous verified commit/image and restore the matching database backup when needed. Do not force old binaries onto an incompatible future schema. Changing environment credentials requires a restart. Revoking Google access should also be done in the Google account; the Disconnect button only removes this app's local stored token.
