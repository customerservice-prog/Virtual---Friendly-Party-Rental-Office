# Verification record

## Verified in the build environment

- `npm run check`: JavaScript syntax checks for the server, storage, workers, adapters and frontend.
- `npm test`: **28 automated backend/HTTP tests passed**. Node 22.16.0; built-in SQLite emits its upstream experimental warning.
- **18 browser interaction assertions passed** with Chromium through the included isolated HTML/script + actual HTTP API bridge harness. No uncaught JavaScript errors were recorded.
- Rendered and visually inspected the 1440-pixel desktop office, employee workspace, owner's camera, 390-pixel mobile office and mobile workspace. No horizontal body overflow at 390 pixels.
- Browser interactions exercised practice startup, three role results, desk selection, evidence/history, unsaved-edit approval blocking, saved correction, exact draft approval, task filtering, separate procedure approval, disconnected-source labels, practice/shadow switching, camera controls and pause.
- HTTP tests separately exercised real server login, wrong-password rejection, origin/CSRF checks, exact-revision conflicts, static path restrictions, export secret exclusion, logout, real SSE change notification and shutdown.
- Mocked integration tests exercised Gmail message deduplication, encrypted secret storage, snapshot validation, bounded model requests, absence of executable model tools and pause abort behavior.

## Explicitly not verified live

- Gmail OAuth with the owner's actual account or Google project.
- OpenAI generation, selected model access, live rate limits or actual charges.
- A real Friendly Party Rental JSON snapshot endpoint; none was guessed or created on the rental backend.
- GitHub read-token access or live website checks from the deployed app.
- Hardware/GPU WebGL: WebGL was unavailable in the managed Chromium environment, so visual checks used the real depth-buffered software 3D renderer. The WebGL code passed syntax checks but needs a GPU-capable device test.
- Hosted URL navigation and actual browser SSE: local browser navigation was restricted, so UI checks used the API bridge; real HTTP/SSE transport was tested separately on Node. A standard hosted end-to-end smoke test remains required.
- Railway/Docker deployment, volume permissions, actual TLS/proxy setup, production backup restoration or multi-day operation.

These results do not certify that AI output is correct or that staff can be replaced. The first operational trial should remain supervised and read-only. No customer message, financial transaction, reservation change or production website deployment was performed by this application during testing.
