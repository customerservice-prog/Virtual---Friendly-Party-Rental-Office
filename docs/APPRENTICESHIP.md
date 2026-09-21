# Apprenticeship and shared case room

This release adds working phone-training, email-observation and team-consultation code to the existing private showroom. It does not enable live observation simply by being deployed. It is not a claim of AGI, independent employees, human replacement, voice cloning, or a live phone/desktop stream.

## Owner workflow

Open **Team case room** in the showroom. Load the explicitly fictional call-to-email example, resume the office, and ask the whole team or a specific teammate for a review. Riley is the phone apprentice, Morgan covers operations, Avery covers written customer care, and Alex covers reported technical issues. The lead asks scoped questions; contributions and evidence IDs are recorded in one case. A single final draft goes to the owner. Approval stores the exact reviewed text and never sends or publishes it.

The global pause stops new work and aborts in-progress provider requests where possible. A per-employee shared-case pause does not resume a globally paused office. An unrelated queued case can proceed when its required employees are available. A case review can be canceled; completed contributions remain visible. Interrupted work is marked blocked after restart, rather than presented as completed.

With no enabled draft model, the team produces explicitly labeled deterministic checklist reviews. With `OPENAI_API_KEY`, `OPENAI_MODEL` and the existing explicit model-sharing consent, it can generate contextual consultations and a synthesized draft. Each full-team review has at most four model requests; a targeted consultation has at most two. There is no recursive employee chat or autonomous tool execution. Peer agreement is not independent verification of prices, availability, balances, or a website fix.

## Learning, not silent model training

A lesson is a source-linked proposal with pending, approved, one-time exception, rejected or revoked states. The owner can edit its text before approval. Placeholder candidates cannot become policy without being rewritten. When a model returns a learning-candidate section, that section becomes a proposal, not an approved rule. Fictional approvals never enter the live handbook or real model context.

An approved real-source procedure is added to the existing shared handbook. Future model reviews can also consult a small selection of private, approved examples whose source revision still matches. Changing the source prevents silently treating later conversation material as the originally approved example. These examples and procedures are contextual retrieval, not fine-tuning or generalized model training. Review lessons for outdated prices, unsupported claims and one-time exceptions.

Model context is deliberately bounded: selected recent call/incoming/sent source excerpts, short peer contributions, and limited approved examples. Long text can be excerpted and not every source in a long thread is included in a model request. Full stored source text is available to the owner. This is not an automatic completeness or accuracy score.

The comparison panel distinguishes an actual private draft saved before a human reply from a retrospective exercise. Sent-folder membership does not prove who authored a message. Confirm the human author explicitly; automated-message indicators disqualify it from human-example confirmation. Replacing a Gmail draft does not suppress the entire thread.

## Gmail observation

The application needs its own Google OAuth credentials and authorization described in `INTEGRATIONS.md`; a ChatGPT connection cannot be reused implicitly. The observer verifies that the authorized account is exactly **customerservice@friendlypartyrental.com** before importing content. It requests only the existing Gmail read-only scope.

In a resumed **Shadow** workspace, use Observation setup to authorize mailbox observation, optional saved-draft capture, optional automatic team reviews and retention. Monitoring defaults OFF. Once explicitly enabled, the application process checks changes every 60 seconds independently of the browser. This implementation uses bounded initial message paging and Gmail history synchronization, not provisioned Pub/Sub push notifications.

Initial lookback defaults to 30 days, configurable from 7 to 90. Each cycle reads at most 25 message records and persists pending IDs, page positions and the initial history anchor. History IDs remain strings, not imprecise numbers. Failed batches resume at the unfinished message; expired history triggers a visibly flagged, bounded resynchronization. Initial paging can take multiple cycles. Connection status distinguishes authorization, last completed synchronization, backlog, gaps and errors; it is not a guarantee of continuous coverage.

Incoming, sent and selected saved drafts are grouped by Gmail thread ID. Labels are recorded as current message state, not a complete click/edit replay. Spam, trash, promotional/social categories and labels named `Friendly/Private` or `Friendly/Do not learn` are excluded. An excluded or deleted imported non-draft message erases and suppresses its entire office case. The app does not create these Gmail labels or modify Gmail. Use deliberate owner-confirmed attachment for cross-channel calls; there is no fuzzy automatic customer match. Sources explicitly mentioning South Carolina are held from NY team review.

Plain text or a provider preview is supported; HTML is not executed, and attachments are not read. Available saved drafts are not every keystroke or a complete edit history. Turning draft observation off stops new draft capture; use case erasure to remove previously retained content. The legacy 10-message manual importer remains a separate feature and does not provide this continuous synchronization.

Official protocol references:
- https://developers.google.com/workspace/gmail/api/guides/sync
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list
- https://developers.google.com/workspace/gmail/api/guides/drafts
- https://developers.google.com/workspace/workspace-api-user-data-developer-policy

## Phone training and optional audio

The current phone provider/device still needs to be identified before a provider-specific automatic connection can be implemented and verified. No microphone permission is requested, no phone routing is changed, and there is no live recording or answering endpoint. Riley's current workflow is **after-call learning**.

Phone training accepts a pasted or `.txt` transcript up to 30,000 characters, with staff name, provider/call reference, completed-call time, and dated consent basis. Staff agreement, caller recording/transcription/AI-processing consent and authorized business-only content are each required. These are importer attestations, not legal certification. Verify applicable recording, monitoring and data-processing requirements before capturing calls; provide an unrecorded alternative as appropriate. Correct speaker labels manually instead of assuming an unidentified voice is Nicole.

Optional audio transcription requires a private `OPENAI_TRANSCRIBE_MODEL` and `OPENAI_API_KEY`, plus separate per-upload provider-sharing permission and sensitive-content-removal attestation. The app accepts up to 8 MB of WAV/MP3/M4A/WebM, checks file signatures, and sends a bounded multipart request to the fixed audio-transcription endpoint. For `gpt-4o-transcribe-diarize`, anonymous speaker labels are returned for owner correction. There is no voice cloning or speaker reference enrollment. The transcript must be reviewed and imported separately. The application does not persist raw audio; this does not establish the model provider's retention policy. API calls may incur charges even if interrupted or unsuccessful. There is no automatic paid transcription retry. Audio uses the existing bounded integration timeout; a slow or long recording may need to be split into shorter clips. Actual provider timing remains to be verified.

Official API reference: https://developers.openai.com/api/docs/guides/speech-to-text

## Signed completed-call delivery contract

A provider-specific bridge must validate its own provider webhook and map an authorized completed transcript to this contract. Merely entering an endpoint in an arbitrary phone service does not establish compatibility.

`POST /api/apprentice/phone-hook`, JSON body, at most 90 KB. Configure a private random `PHONE_WEBHOOK_SECRET` of at least 32 characters, enable transcript delivery with explicit scope consent, and resume Shadow. The endpoint remains disabled otherwise. Do not commit that key or any recording/customer payload.

Required JSON keys: `eventId`, `callId`, `provider`, `trainer`, `at` (completed-call ISO time), `transcript`, and `consent: {staff:true, caller:true, businessOnly:true, at:<ISO time>, basis:<where permission is documented>}`. Optional `title`. External deliveries cannot supply a caseId to attach themselves to another case.

Headers: `x-office-timestamp` (Unix seconds), `x-office-signature` (`sha256=` plus lowercase HMAC-SHA256 hex). Sign the timestamp, a dot, then the **exact raw request bytes** using the bridge secret. Signature freshness is five minutes, comparison is constant-time, and event receipts plus stable call source IDs deduplicate replay. Original deliveries cannot overwrite an owner-corrected transcript; conflicting new provider versions require manual review. Owner imports can attach a call to a verified existing case after explicit same-case confirmation.

## Storage, privacy and cost boundaries

Additive tables share the existing persistent SQLite database. Real conversation titles, sources, internal messages, drafts, review decisions and lesson candidates are encrypted with the private `INTEGRATION_ENCRYPTION_KEY`. Keep a backup of that key outside GitHub; losing or replacing it makes retained content unreadable. Approved handbook procedures use the existing handbook storage, so keep unnecessary personal information out of reusable rules.

Automatic pattern redaction is best effort, not complete sensitive-data detection. Remove card data, passwords and unrelated private information before importing or transmitting to a model. Production credentials, recordings and real customer evidence must never be placed in this public repository or CI artifacts.

Inactive-case retention defaults to 30 days and is configurable from 7 to 90. Hourly cleanup skips queued/running cases and active imports/reviews. Erasure cascades through apprenticeship sources, notes, jobs, drafts and decisions; source-linked handbook lessons are revoked and their text removed. Hashed exclusion markers prevent reimport. Erasure is not provider deletion, backup erasure or deletion of separately imported legacy tasks. The legacy office export does not include the new private case corpus; protect the database backup separately. Inspect full case records through the protected case UI/API.

All attempted draft/transcription requests share the existing daily call budget (default 20, configurable 1–100). This is a request count, not a guaranteed dollar spending ceiling. A full team review can consume four slots. Cases stop visibly on budget or provider failure; they are not silently marked successful. The source-change retry only coalesces newly arrived evidence and remains subject to the same budget. Customer sends, mailbox edits, phone answering, payments, reservations and production-code publishing remain disabled.

## Verification scope

`npm run check` and `npm test` cover the additive store, consent and authentication checks, encrypted content, source revision guards, unique jobs, pause/cancel/restart, bounded model calls, mock transcription, lesson separation/revocation, suppression and mocked Gmail paging/history recovery. `tests/apprentice-ui.py` drives a real disposable Node backend in Chromium with fictional records; it does not contain production credentials. Existing showroom/browser tests remain in CI.

Production's opt-in public verifier checks exact frontend asset bytes and denial of unauthenticated case/lesson access. A successful deployment or mock-provider test is not a successful real Gmail, phone, or paid-model integration. Live source authorization, actual provider deliveries, real recordings and restore of production backups must be verified separately.
