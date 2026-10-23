# Milestones 1.6.0

Milestones counts down to upcoming events and tracks time since past milestones. It is an installable, offline-capable PWA with optional Google Drive synchronization.

**App:** https://markz68.github.io/milestones/

## Everyday use

- Use **Add event** above the timeline to create an event. Select a timeline entry to view, edit, or delete it.
- Store an exact date, month/year, or year only. Unknown parts remain unknown and elapsed time is labeled approximate.
- Annual events can retain an original date for birthdays and anniversaries, or repeat without an origin year for holidays such as Christmas. February 29 is observed on February 28 in non-leap years. Floating holidays are not supported.
- Event type controls birthday/anniversary wording independently of icons and categories. Search, category filters, pins, and date/name sorting remain available.
- The **top-right gear, labeled Settings**, opens the single Settings panel. Google Drive, Local backups, and Advanced recovery are all here. There is no duplicate Backup & Sync button at the bottom. Storage/sync status and the version remain below the timeline.
- The Settings gear follows the shared PWA Survival Builder convention: gear only, accessible name and tooltip **Settings**, and a touch target of at least 44 × 44 pixels. Milestones retains its green theme.

## Install on Android and Windows

1. Open the app URL in Chrome or Edge while online.
2. On Android, use **Install app** or **Add to Home screen**, depending on the browser. On Windows, use the browser's install-app option when offered, or continue using the normal browser tab.
3. Open once online so the service worker can cache the app shell. Existing events and local editing can then work offline. Google connection and sync require internet access.
4. Browser profiles, private sessions, and devices can have separate local event lists. Installing the PWA does not itself back up events.

## Settings: Google Drive

Choose the gear → **Google Drive**, leave **Automatically sync while connected** checked if desired, and choose **Connect Google Drive** on each device with the same account.

- Automatic sync checks about four seconds after saved edits, when returning to the app or regaining internet, and approximately once a minute while visible. A debounce and minimum 15-second start interval prevent duplicate requests. One sync runs per tab at a time.
- Automatic checks wait while Settings, an editor, or a confirmation is open. Closing them resumes scheduling. **Sync now** remains available inside Settings when connected.
- Turn off automatic sync to use only **Sync now**. The preference is stored separately per browser/device.
- Access tokens stay only in page memory. Reconnect after reload or token expiration. Sync does not reliably run while the app is closed or suspended.
- Temporary network errors, 429 responses, and server errors retry with increasing delays of 30 seconds to five minutes. Invalid data, denied permissions, and conflicts pause automation for attention.
- Manual incoming merges and paused conflicts use readable in-app review dialogs. **Cancel** and Escape leave the proposed merge unapplied. Newer changes win per event, including deletion records; there is no field-by-field conflict editor.
- Local backup/restore controls are unavailable during an active sync to avoid overlapping operations.
- **Disconnect this session** drops this page's access token and preserves local events, account binding, and cloud data. It does not revoke the shared Google authorization.

Google authorization is **In production**, as confirmed by the owner on October 21, 2026. The Testing-specific seven-day authorization limit no longer applies. Production does not provide permanent browser login. The project is shared with Infinity Bottle, but app files remain separate.

### Google configuration

The public OAuth Web client ID in `drive-config.mjs` is retained, with authorized origin `https://markz68.github.io` and the Drive API enabled. Only `https://www.googleapis.com/auth/drive.appdata` is requested; no Gmail or ordinary Drive document access is requested. Google Identity Services loads when Settings opens. The repository contains no client secret, access token, or refresh token.

Milestones obtains the Drive account identifier and available account email to identify the connection and bind this browser's first sync to that account. A different account is refused to prevent accidental transfer to another account. Do not replace the client ID or clear site storage as an update procedure.

Shared authorization information pages:

- Homepage: https://markz68.github.io/milestones/about.html
- Privacy: https://markz68.github.io/milestones/privacy.html
- Terms: https://markz68.github.io/milestones/terms.html

### Merge and concurrency

Milestones appends immutable `milestones-sync-v1-<uuid>.json` snapshots tagged `app=Milestones` in private Drive application-data storage. Every snapshot participates in future merges; no existing cloud snapshot is overwritten or deleted. Infinity Bottle files are not read or modified. A concurrent device's changes can need another pass to appear.

Stable event IDs and edit timestamps determine the merge. Deletion wins an exact timestamp tie; equal-time edits use a deterministic tie-break. Different IDs remain separate even when names match. Keep device clocks accurate and avoid independently entering the same event on multiple devices.

Uploads are downloaded again and verified before a changed local state is saved. Failures or canceled merges preserve local events. If local saving fails after upload, the cloud snapshot remains recoverable on a later sync. Edits arriving during upload are retained and may need a further pass. Unchanged sync checks do not replace the local undo point.

Limits: 20 MB per snapshot/import, 2,000 cloud snapshots, 10,000 active events, and 20,000 deletion records. Incomplete listings and malformed data stop sync. Cloud history is not pruned automatically and consumes Drive storage. Last-sync status describes the last completed check, not a guarantee that another device has no unsynced edits.

## Settings: Local backups and recovery

**Download JSON backup** saves a restorable copy. Keep dated copies outside the browser. A download request cannot verify the file was actually saved. **Export CSV for Excel** is for viewing, not restoration; formula-like values are escaped.

**Import JSON backup** validates the file and shows an in-app review before merging. Missing events are added; newer edits and saved deletions win for matching IDs. Export the current list first if a separate copy is needed. Schema 4 backups contain events, date precision, annual behavior, event types, and deletion records. Older schema 1, 2, and 3 backups remain readable. An old backup does not silently resurrect a newer deletion.

Expand **Local backups → Advanced recovery** for:

- **Check older local events:** previews a merge from the retained pre-sync browser copy. Newer edits and deletion records are preserved. If the copy is absent, import a saved JSON backup instead.
- **Restore previous local state:** reviews replacement of the current event list with the single previous local state. The restore creates newer edits/deletions that can sync. The undo point is replaced by the next save, import, or sync that changes events; unchanged checks leave it intact. It is not an independent backup.

Deletion, import, restore, recovery, and sync reviews use in-app dialogs with explicit Cancel and action buttons. Escape cancels. Cross-tab changes close outstanding dialogs; restore and legacy recovery also recheck for changes during review. Event deletion shows the event name, date, and category before confirmation.

## Storage and data preservation

The current document remains at `milestones.state.v3` with schema 4. The retained legacy key is `milestones.events.v1`; the undo key is `milestones.previous.v3`. Google account binding, last-sync metadata, and automatic-sync preference keys are unchanged. Version 1.6.0 performs no data migration or reset.

Clearing site data, removing browser profiles, or private-session expiry can remove local events. Other apps at `markz68.github.io` share a browser security boundary and may also be affected by site-data clearing. Personal events are not committed to GitHub. Export backups before uninstalling or removing site storage. Use one editing tab per device and close old app tabs after upgrades.

## Updates and troubleshooting

After an update, close all Milestones windows/tabs, including installed app windows, then reopen online and check the footer for **v1.6.0**. The new service worker may wait for older app windows to close. On Windows, refreshing the online browser page can also retrieve the latest files. Do not clear site storage or uninstall to force an update.

Only Milestones app-shell caches are replaced; local event storage and unrelated app caches are not cleared. The cache is `milestones-shell-v1.6.0` and includes the new confirmation module. Google API responses and event backups are not cached by the service worker. Network failures fall back to cached app assets.

If sync fails, read Settings' status, confirm internet access and the original Google account, then reconnect or use Sync now as directed. Export JSON before any recovery action. Mocked tests cannot verify live Google consent or real device-to-device operation.

## Android and Windows release checklist

Run on **both** devices:

- Confirm v1.6.0, existing event totals, dates, categories, and notes after reopening online.
- Check one top-right Settings gear and no bottom Backup & Sync button. Open/close Settings using the gear and close control; on Windows also check keyboard navigation and Escape.
- Confirm Drive controls, automatic-sync preference, JSON export/import, CSV, and collapsed Advanced recovery are accessible. Download JSON and verify the saved file. Cancel an import/restore review to confirm nothing changes.
- Add a disposable event. Open Delete and cancel; confirm it remains. Then delete it through the in-app confirmation.
- Connect the original Google account on both devices. Close Settings and test addition, edit, and deletion propagation. Verify manual Sync now still works inside Settings. Do not expect an existing page-memory session to survive a reload.
- After opening online, go offline and reopen the app. Verify existing events are visible and an edit is saved locally; reconnect, close Settings, and verify sync resumes.
- Check Android touch targets, panel scrolling, and portrait display. On Windows, check Tab/Shift+Tab, visible focus, Escape cancellation, and readable dialogs.

## Development and deployment

Stable root files are served by GitHub Pages from **main / (root)**; `.nojekyll` bypasses Jekyll. No build or dependency installation is required. Public code is separate from each user's local/Drive records.

Run `node --test tests.mjs sync-tests.mjs auto-tests.mjs` and JavaScript syntax checks. Tests cover calendar handling, old/new backups, tombstones, concurrency, cloud verification/failures, and scheduler timing/retry behavior. Browser QA covers Settings access, confirmations, and local event actions. Android/Windows installation, live Google authorization, and cross-device behavior require the device checklist above.

Increment the displayed semantic version, README, and service-worker cache together. Verify the GitHub commit and Pages deployment separately. Do not assume a successful commit means deployment has finished.

## Release history

- **1.6.0:** PWA Survival Builder compliance: gear-only Settings entry, redundant bottom button removed, in-app import/recovery/sync confirmations, stale-review safeguards, and refreshed documentation. Existing data keys, Google client configuration, and merge rules retained.
- **1.5.0:** Combined Backup & Sync panel, Settings gear, collapsed advanced recovery, readable event deletion confirmation.
- **1.4.1:** Shared app information, privacy, and terms pages.
- **1.4.0:** Automatic sync while open and connected, conflict pauses, retry scheduling, and snapshot caching.
- **1.3.0:** Event types, birthday/anniversary wording, categories, sync summary, schema 4.
- **1.2.x:** Verified Drive sync, deletion history, legacy recovery, fetch-context fix, and timeline/data-tools layout.
- **1.1.x:** Annual events, phone readability, and expanded icons.
- **1.0.0:** Local events, date precision, backup/import, CSV, and offline app shell.
