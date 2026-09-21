# Owner command center

The existing showroom now has a live four-person team screen and a **Talk to team** button. The briefing room shows Morgan, Avery, Alex and Riley as clickable avatars alongside a shared work display, a recorded inter-employee message feed and Bryan's conversation panel. This is working UI over recorded state, not a camera or remote desktop stream.

## Talking with the team

Choose Everyone or an individual employee. Type an instruction or use optional browser dictation, review the text and press Send. Follow-up messages remain in the same encrypted case in Shadow; Practice conversations are labeled fictional. Request IDs prevent duplicate messages. An in-progress answer must finish or be canceled in its case view before a follow-up is queued. Case revisions prevent an old browser tab from overwriting new work.

A request includes current office status evidence. The optional Read website and Read order snapshot choices perform the existing narrow, read-only source checks in Shadow only. A missing source is a visible blocker. The owner can inspect the underlying evidence and approve the final text, but approval does not send email, change orders, charge payments or publish code.

Without a configured and enabled model, owner replies are deterministic, clearly labeled office briefs and role checklists. With an enabled model, the existing bounded consultation system handles the instruction. Peer discussion is recorded, not hidden model reasoning. All existing model-call limits remain in effect. Context is bounded as documented in APPRENTICESHIP.md.

## Continuous availability

The server, not an open browser tab, owns the queue and standing-duty timer. Continuous duty starts enabled but respects the existing global pause. **Start continuous shift** resumes processing without authorizing a new mailbox, phone source or model. Pausing standing duties does not cancel ordinary assignments; use **Pause all employees** for a global stop.

The dispatcher wakes every 15 seconds. It checks saved backlog/review/blocker counts approximately once a minute, and checks configured website/order sources approximately every 30 minutes in Shadow. A paused employee or missing connection prevents that check. Queue pressure postpones new reports. Identical reports do not create duplicate cases. Standing checks do not invoke a paid model. Gmail's already-authorized observer and phone transcript intake remain separate and do not become connected by turning on continuous duty.

These are availability and scheduling controls, not a promise of uninterrupted uptime or nonstop useful work. Infrastructure outages, missing access, model quotas, source errors and pending owner decisions can still block progress. A waiting worker must be shown as waiting rather than animated as busy. Railway configuration disables sleeping and requests automatic restart; verify the deployed service configuration.

## Voice and privacy

Dictation uses the browser's SpeechRecognition implementation when present. It is opt-in per session, can require browser permission, may send audio to the browser vendor's speech service, and has limited cross-browser support. Unsupported or failed dictation retains typed input. It does not activate automatically, does not record customer calls, and never sends dictated text automatically. It stops on user action, navigation, tab hiding, logout or the one-minute cap. Read-aloud uses browser speech synthesis only on an explicit owner action. Real microphone/provider behavior requires real-device verification.

Protocol references:
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- https://docs.railway.com/deployments/serverless

The shared live feed includes at most 20 recent private case notes, with long entries visibly excerpted; complete records remain in the protected case view. It is not a complete surveillance log of all business activity. Browser connection loss is labeled, and private conversation UI is cleared on logout. Existing encryption, consent, deletion and retention controls apply to owner cases.

## Verification

The Node tests cover owner/team routing, follow-up context, private storage, deduplication, global pause, standing checks, actual mock-source reports, missing-source handling and access boundaries. The Chromium suite uses a real disposable application and fictional records to verify desktop/mobile controls, recorded collaboration, reply persistence, input preservation, focus mode and logout. It does not validate a real microphone, live customer mailbox or live phone connection.
