# Showroom frontend · September 2026

The default signed-in frontend follows the owner's chosen black-and-gold showroom reference. The room illustration is scenery. Employee cards, sidebar, owner review, task counts, instructions, login and dialogs are real HTML/CSS/JavaScript controls using the existing authenticated task API. No fake sales, stock or booking counts are displayed.

## Views

- **Showroom** is the photo-style illustrated background with clickable employee workstations. The four Room views are crops of that illustration, not CCTV or video feeds.
- **Explore 3D** retains the original rotatable spatial office and camera controls; it is not a photogrammetric reconstruction. It is lazily initialized and does not animate while hidden.
- Orders, Customers, Schedule and Reports show supplied office tasks or source status, not a fabricated full CRM. Inventory and Finances disclose that the relevant live sources are absent. Settings opens the existing connections, handbook and export tools.

## Build

Run `npm run build` before direct `node server.mjs` use. `npm start`, `npm test`, `npm run check` and the Docker build do this automatically. Runtime requires no npm dependencies.

`public/index.html`, `public/hq.js` and `assets/styles/part-*.css` are the showroom frontend source. The five stylesheet fragments concatenate in order to exactly one CSS file; fragments are not independently valid stylesheets. The nine binary fragments in `assets/showroom` are one AVIF illustration, split solely to fit connector upload limits. SHA-256 and size checks fail the build if any fragment is missing or altered. No remote asset host is needed.

`scripts/build-showroom.mjs` applies narrowly checked, idempotent changes to the original app, spatial renderer, static asset allowlist and bootstrap. It does not change the task engine, sessions, approvals, provider configuration or business permissions. Review the expected-source guards when upgrading the underlying app. Do not replace `public/scene.js` with a preview stub.

## Verification

`npm test` includes backend tests and build/asset assertions. `tests/showroom-ui.py` runs an actual Node backend with a disposable SQLite database and fictional practice tasks, then tests it in Chromium. It never receives production credentials. The browser job saves screenshots and a structured check report.

The optional `SHOWROOM_HOSTED_CHECK=1` startup probe verifies that the public HTTPS URL serves the exact HTML, CSS, JavaScript and illustration built into the running image, plus image MIME type, security headers and anonymous API denial. It is read-only and logs booleans, never credentials or customer records. This is HTTP deployment verification, not an authenticated graphical browser test.

## Safety boundaries

Owner login remains required. Practice and read-only shadow modes are unchanged. Approving records an exact draft, not an email send. No payments, refunds, customer contact, booking writes, new model use or publishing permissions were enabled by the visual update.
