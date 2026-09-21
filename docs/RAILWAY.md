# Railway launch configuration

The virtual office is deployed separately from the NY and SC rental websites. Never reuse their services, volumes, or database credentials.

## Volume and non-root runtime

Use exactly one replica and attach a persistent volume at `/app/data`. Set `DATA_DIR=/app/data`. Railway provides `RAILWAY_VOLUME_MOUNT_PATH`; do not fake that variable to bypass mount validation.

Railway currently mounts volumes as root (see https://docs.railway.com/volumes#permissions). Set `RAILWAY_RUN_UID=0` ONLY with this repository's Dockerfile and `node bootstrap.mjs` startup. The bootstrap briefly prepares the volume directory and immediately drops supplementary groups, GID and UID to 1000 before loading the server or opening the database. The long-running app must report `runtime uid=1000, gid=1000`. Do not override the start command back to `node server.mjs` while setting Railway's root UID option.

The bootstrap refuses missing or mismatched Railway mounts instead of silently losing tasks to ephemeral storage. It does not recursively change ownership. Existing root-owned database files need a deliberate one-time migration, not broad recursive ownership changes.

## Owner access

Set `NODE_ENV=production`, `PORT=3000`, a unique 16+ character `OWNER_PASSWORD`, and exact `PUBLIC_ORIGIN=https://<generated-domain>` in Railway variables. Never put the password in repository files, URLs, logs, screenshots or build arguments. The root page is a public login shell; `/api/state`, tasks, exports, events and integrations require a session. Keep all optional business integrations absent during the practice launch.

## Hosted verification

Before allowing business data, verify health, unauthorized API denial, owner login, wrong-origin and missing-CSRF denial, Secure/HttpOnly cookies, practice tasks, exact-draft approvals, pause, and persistence after a redeploy. Only claim the checks actually run. Backups and restore rehearsal are separate from persistence tests; see DEPLOYMENT.md.

Hosting consumes Railway resources. With no model keys or connected providers configured, practice mode makes no paid model calls and no customer sends or booking changes.
