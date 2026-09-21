# Showroom display refinement

The selected black-and-gold showroom remains the default actual frontend. Its controls use the existing task API. This patch does not enable any new business connection or write permission.

Scenic zoom uses a tested image-boundary clamp so the front door, concessions and storage views do not expose empty edges. On phones the full overview composition is visible above four accessible room-view controls. All three staff cards are visible without swiping through a horizontal carousel. Owner review, pause, drafts, login and the spatial view are unchanged.

`public/showroom-layout.mjs` is the pure sizing helper. The build bundles it into the existing app module before `public/hq.js`. `assets/styles/refinements.css` follows the original verified style bundle. No runtime dependencies were added.

Verification: `tests/showroom-layout.test.mjs` checks viewport geometry. `tests/showroom-layout-ui.py` uses Chromium with an isolated real Node backend to test 320/390/430/640/768/1024/1440/1672px widths and every scenic room. Screenshots and reports are saved in the existing CI artifact. Small compressed screenshot previews in the CI log contain only the empty fictional test workspace. The optional public hosted-browser check verifies the sign-in screen, public illustration and anonymous API denial. It does not claim authenticated live-business testing.
