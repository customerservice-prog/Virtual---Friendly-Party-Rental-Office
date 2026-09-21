# Showroom visual verification

The selected black-and-gold showroom remains the default actual frontend. Its controls use the existing task API. This patch preserves the watch-view, keyboard desk shortcuts, bounded scenic crops and mobile selector already added to main. It does not enable any new connection or business permission.

Normal mobile Showroom mode now fits the full reference composition above its controls instead of cropping most of the room off-screen. Watch mode retains the larger immersive view. All three employee cards remain visible, without a horizontal carousel. Visible keyboard focus outlines and safe-area spacing are retained.

`tests/showroom-layout-ui.py` adds Chromium checks at 320/390/430/640/768/1024/1440/1672px widths, every scenic room, mobile employee desks and owner review. These signed-in tests use a disposable real Node backend. The public hosted-browser checks visit only the real HTTPS sign-in page and confirm anonymous API denial; they are not authenticated live-business tests.

Full screenshots and JSON reports are in the CI artifact. Small screenshot previews in the CI log contain only an empty fictional test office. No production credentials, private records or new model calls are used.
