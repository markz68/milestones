# Milestones 1.4.1

Personal milestone tracker: count down to future events and track time since past events. Responsive list with detail/edit dialogs, approximate dates, annual repeats, and Google Drive sync with optional automation.

## Events

- Exact date, month/year, or year only. Unknown date components remain unknown.
- One-time events count down before their date and up afterward.
- Annual events with an original date retain elapsed time and the next anniversary in one entry. Original month/year is supported with approximate wording; year-only needs a known month before annual repetition can be enabled.
- Annual holidays without an origin year store only MM-DD. February 29 uses February 28 in non-leap years, explained in the editor. Floating holidays are not supported.
- Notes, date sources, categories, pins, search, sorting, and icons including wedding rings, Christmas, home, and travel.
- Larger phone text, controls, and stacked event rows.

## Google Drive sync

Version 1.4.0 adds automatic sync while the app is open and connected. Open **Google Drive sync**, keep **Automatically sync while connected** checked, and choose **Connect Google Drive** on each device using the same Google account. Sync starts after connection, about four seconds after saved edits, when you return to the app or regain internet access, and approximately once a minute while visible. Reconnect when the Google session expires or the page reloads. No credentials are saved to keep a session alive. Turn off the toggle to use only **Sync now**. The preference is saved separately on each browser/device.

The OAuth Web client ID in `drive-config.mjs` is public configuration, reused from Infinity Bottle because both apps use `https://markz68.github.io`. No client secret, API key, refresh token, or access token is stored in the repository. Access tokens stay in page memory. Google Identity Services loads when the sync dialog opens. The Google Cloud project must have the Drive API enabled, the origin authorized, and any required test-user access configured. The consent screen may retain the existing project's name. No Gmail access is requested.

Only the `drive.appdata` scope is requested. Google account information is obtained from Drive to show the connected account and bind this browser's first sync to its account ID. A different account is refused to prevent accidentally uploading one account's local events to another. Disconnect forgets this page's token and preserves local events, account binding, and cloud data. It does not revoke the shared OAuth grant or disconnect Infinity Bottle.

### Merge and concurrency behavior

Milestones writes immutable, separate snapshots named `milestones-sync-v1-<uuid>.json` in the private application-data space, tagged `app=Milestones`. It never reads, modifies, or deletes Infinity Bottle files. No existing cloud snapshot is overwritten. Older snapshots are combined with the current local state on every sync. Concurrent uploads therefore remain available for the next sync instead of replacing one another. A concurrent device's changes may require another sync to appear.

- Merge uses stable event IDs and edit timestamps. Newer changes win for the same ID.
- Saved deletions are timestamped and sync too. A deletion wins an exact timestamp tie. Equal-time edits use a deterministic tie-break so all devices converge.
- Different IDs remain separate, even if titles match. Independently entering the same event on two devices can produce duplicates; review before deleting an extra entry.
- Keep device clocks correct. Timestamps advance past previously seen changes. Whole events, rather than individual fields, are merged; concurrent edits to the same event do not combine notes field-by-field.
- Manual sync asks for confirmation before applying incoming changes. Automatic sync applies routine merges quietly, but pauses for review if the same event has changed on both devices, or for an initial nonempty merge without a previous sync baseline. The upload is read back and checked before local merged state is saved. A canceled merge or failed upload leaves local events unchanged. If local saving fails after upload, the cloud snapshot remains and the next sync can recover it.
- Local changes arriving during upload are retained and marked as needing another sync.
- Sync refuses malformed cloud data, incomplete listings, snapshots over 20 MB, more than 2,000 snapshots, or state exceeding 10,000 active events / 20,000 deletion records. It never prunes history automatically. Frequent use will eventually need history maintenance; export backups before any future maintenance.

Status reports the last completed check, not a guarantee that another device has no unsynced changes. Cloud snapshots consume Drive storage. They are not a substitute for independent dated backups, and can be removed through Google account/app-data management.

## Backups and local data

**Export JSON on each device before your first sync.** JSON is for restoration; CSV is for viewing in Excel and escapes formula-like text. Keep dated copies outside the browser. A download request cannot verify the file was saved.

Schema 4 JSON includes events, date precision, annual behavior, event type, and timestamped deletion records. Schema 1, 2 and 3 backups remain importable. Update both devices to v1.3.0 before syncing; older releases cannot read schema 4 cloud snapshots and stop rather than silently discard event type. Import merges newer edits and deletions; an old backup does not silently resurrect a later deleted event. To undo a recent deletion, use **Restore previous local state**, which prompts before creating a new change restoring those events. The single undo point is replaced by the next save, import, or sync that changes local events. An unchanged automatic check leaves it intact. It is not an independent backup.

The first 1.2.0 visit migrates existing events and their IDs into the atomic `milestones.state.v3` local-storage document. The older `milestones.events.v1` copy is retained but no longer updated. Do not downgrade and edit using older app versions after migration. Close older app tabs on each device. Cross-tab updates refresh the list and close editors to prevent stale saves; use one editing tab at a time.

Events remain accessible offline after the app shell has been cached. Browser/site-storage clearing, profile removal, or private-mode expiry can remove local data. Installing the PWA and hosting code on GitHub do not back up events. Personal events are never committed to GitHub. Other apps on the same `markz68.github.io` origin share a browser security boundary; deploy only code you trust.

## Publish and verify

Serve the files at repository root using GitHub Pages, branch **main**, folder **/(root)**. `.nojekyll` bypasses Jekyll. No local build or dependency installation is needed. Check the Actions deployment result rather than assuming a successful upload has published. If no build starts, resetting the Pages publishing branch from None back to main has worked for this repository.

After deployment, close old app tabs, reopen while online, and check **v1.4.0** in the footer. On each device connect the same Google account. Sync the PC first, then the phone, then the PC again. Test adding, editing and deleting a disposable event across devices. Test an offline edit followed by reconnecting and syncing. Independently exported backups should remain available throughout.

Google OAuth and real phone-to-PC sync need live testing on the user's devices; mocked API tests cannot establish that the configured Google account has granted access.

## Development and release history

Run `node --test tests.mjs sync-tests.mjs auto-tests.mjs` for calendar dates, old/new backups, tombstones, deterministic conflicts, simultaneous first syncs, failures, pagination, verification and in-flight local edits. Serve over HTTP/HTTPS rather than `file://`. OAuth is authorized for the deployed HTTPS origin, not the local preview. Increment `CACHE` in `sw.js` when updating the app shell. Cache contains application assets only, not event backups or Google API responses.

- 1.0.0: local events, precision, backup/import, CSV and offline app shell.
- 1.1.0: phone readability and annual events with optional original dates.
- 1.1.1: expanded event icon picker.
- 1.2.0: manual Google Drive sync, deletion history, verified cloud snapshots and backward-compatible backup migration.

- 1.2.1: fixes browser fetch context during Google connection and adds **Check older local events** under Backup & restore. Recovery merges the retained pre-sync local copy after confirmation; it never clears local storage. If the old copy is absent, import a saved JSON backup. A report of a missing phone event remains unconfirmed as to cause; no assumption is made that migration, storage clearing, or Google sync caused it.

- 1.2.2: moves Add event into the timeline header and Google Drive sync / Backup & restore below the timeline near the footer, with full-width phone buttons.

## Everyday improvements (1.3.0)

- **Visible sync status:** bottom controls show never synced, local changes pending, sync in progress, last successful sync, and offline status. “No local changes” describes this device only; it cannot detect changes on another device until Sync now is used. Last-sync metadata changes from another tab update the summary.
- **Event type:** General milestone, Birthday, Wedding / marriage, Other anniversary, or Holiday. Type controls wording and is independent from icon, category, and recurrence. Existing entries default to General milestone without guessing. Edit an entry to choose a type, and retain annual timing for annual countdowns. Birthday with original year shows Turning N or Turns N today; without a year, Next birthday. Wedding shows Nth wedding anniversary. Approximate months retain unknown-day wording.
- **Category filter:** All categories, Uncategorized, and categories from your saved events. Works with All / Upcoming / Past, search, and sorting. Totals remain overall event totals. A selected category remains selected after its final event is removed, showing no matching events until another filter is selected.
- Schema 4 preserves event type in backups and Drive snapshots and reads older schemas. The existing local storage key is retained; no data reset or second migration key is introduced. Existing schema 3 deletion history is preserved. Update all devices before syncing to prevent older clients rejecting the new schema.

## Automatic sync (1.4.0)

Automatic sync is enabled by default and can be disabled in the Drive panel. It requires the app to be open, visible, online, and Google-connected. It does not run on the server or reliably while the app is closed or suspended. Focus, visibility, reconnect, saved-change and periodic signals queue checks; a debounce and minimum 15-second start interval prevent duplicate requests. Only one sync runs per tab at a time. Independent tabs/devices remain safe through immutable cloud snapshots; use one editing tab per device.

Temporary network errors, 429 responses and server errors retry with increasing delays of 30 seconds to five minutes. Retry schedules cannot be accelerated by focus signals. Invalid data, denied permissions, or merge conflicts pause automation and display a status requiring attention. Token expiry clears the page session and asks for reconnection; background tasks never open sign-in popups. Manual Sync now remains available for reviewing an initial merge or conflict. A canceled review leaves auto sync paused until manually resolved. Toggling off prevents queued work; an already-running request may finish.

Automatic checks wait while an event editor or backup panel is open, and recheck before applying downloaded data. Local events remain unchanged if a review is required or an editor opens during network activity. No-change syncs neither write local data nor replace the undo point. Cloud snapshots are cached in memory using their Drive checksums so repeated checks download only new or changed snapshots; no cloud files are deleted. A sync that incorporates remote data creates a local undo point, as before.

Same-event conflict detection compares local and cloud records with the previous successful sync baseline, including deletions. Independent event edits merge without a prompt. Conflict review still uses the documented newer-change-wins merge; it does not provide field-by-field reconciliation. Different IDs remain separate. Keep JSON backups.

All existing schema 4 data, account bindings, event IDs, and backups remain compatible. No schema or local-storage migration is introduced in 1.4.0. Changes to Infinity Bottle are outside this release.

Validation includes scheduler timing, retries, expiry/editor deferral, conflict pauses, unchanged-sync undo preservation, immutable-snapshot caching, and the existing date/backup/merge tests. Live Google authentication and device-to-device behavior must also be checked on the user's devices after deployment.


## Production authorization preparation (1.4.1)

Public information pages for the shared Google authorization project:

- Homepage: https://markz68.github.io/milestones/about.html
- Privacy policy: https://markz68.github.io/milestones/privacy.html
- Terms: https://markz68.github.io/milestones/terms.html

These pages describe both Milestones and Infinity Bottle. The Milestones footer and Drive dialog link to the disclosures. Sync behavior and existing event storage are unchanged. The release does not change Google's publishing status.

In the existing Google Cloud project (project number 694239144470), open Google Auth Platform:

1. Branding: review the existing app name, support email, developer contact, and public links above. Use contact addresses you monitor. Avoid renaming an existing project solely to match one app because authorization is shared.
2. Data Access: confirm the apps' requested Drive permission is `https://www.googleapis.com/auth/drive.appdata`. Do not add broad Drive scopes for production. Review any other clients/scopes in the project before removing anything.
3. Clients: preserve the existing Web client ID and authorized origin `https://markz68.github.io`. Do not create a replacement client, add a client secret to the apps, or change storage keys.
4. Audience: review the current External / Testing status and select Publish app when the console's prerequisites are satisfied. Follow any Branding or Verification Center issues actually shown. Publishing and brand verification are separate. A homepage/privacy/terms page alone does not guarantee approval or domain verification.
5. Confirm the console explicitly shows In production. Then reconnect using the same Google account on each device and test both apps with backups available. Do not delete cloud data to change publishing status.

Production removes the Testing-specific seven-day authorization expiry and the need to pre-list test users. It does not provide permanent browser access tokens or closed-app sync. Milestones still reconnects after reload/expiry; Infinity Bottle still uses manual sync and currently explicitly requests consent when Connect is pressed. Infinity Bottle's Disconnect revokes the shared Google grant, so it can also affect Milestones authorization. That behavior is unchanged by this release.

Console settings and verification cannot be inferred from repository deployment. As of preparation, this environment could not open Google Cloud Console, so production publishing must be completed and verified separately in the account's console.
