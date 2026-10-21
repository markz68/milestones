# Milestones 1.2.2

Personal milestone tracker: count down to future events and track time since past events. Responsive list with detail/edit dialogs, approximate dates, annual repeats, and manual Google Drive sync.

## Events

- Exact date, month/year, or year only. Unknown date components remain unknown.
- One-time events count down before their date and up afterward.
- Annual events with an original date retain elapsed time and the next anniversary in one entry. Original month/year is supported with approximate wording; year-only needs a known month before annual repetition can be enabled.
- Annual holidays without an origin year store only MM-DD. February 29 uses February 28 in non-leap years, explained in the editor. Floating holidays are not supported.
- Notes, date sources, categories, pins, search, sorting, and icons including wedding rings, Christmas, home, and travel.
- Larger phone text, controls, and stacked event rows.

## Google Drive sync

Version 1.2.0 adds **manual** sync. Open **Google Drive sync**, choose **Connect Google Drive**, then **Sync now**. Use the same Google account on both devices. Sync the device you changed, then the other device. Reconnect when the Google session expires or the page reloads. Sync does not run in the background or automatically after edits.

The OAuth Web client ID in `drive-config.mjs` is public configuration, reused from Infinity Bottle because both apps use `https://markz68.github.io`. No client secret, API key, refresh token, or access token is stored in the repository. Access tokens stay in page memory. Google Identity Services loads when the sync dialog opens. The Google Cloud project must have the Drive API enabled, the origin authorized, and any required test-user access configured. The consent screen may retain the existing project's name. No Gmail access is requested.

Only the `drive.appdata` scope is requested. Google account information is obtained from Drive to show the connected account and bind this browser's first sync to its account ID. A different account is refused to prevent accidentally uploading one account's local events to another. Disconnect forgets this page's token and preserves local events, account binding, and cloud data. It does not revoke the shared OAuth grant or disconnect Infinity Bottle.

### Merge and concurrency behavior

Milestones writes immutable, separate snapshots named `milestones-sync-v1-<uuid>.json` in the private application-data space, tagged `app=Milestones`. It never reads, modifies, or deletes Infinity Bottle files. No existing cloud snapshot is overwritten. Older snapshots are combined with the current local state on every sync. Concurrent uploads therefore remain available for the next sync instead of replacing one another. A concurrent device's changes may require another sync to appear.

- Merge uses stable event IDs and edit timestamps. Newer changes win for the same ID.
- Saved deletions are timestamped and sync too. A deletion wins an exact timestamp tie. Equal-time edits use a deterministic tie-break so all devices converge.
- Different IDs remain separate, even if titles match. Independently entering the same event on two devices can produce duplicates; review before deleting an extra entry.
- Keep device clocks correct. Timestamps advance past previously seen changes. Whole events, rather than individual fields, are merged; concurrent edits to the same event do not combine notes field-by-field.
- A confirmation appears before merging cloud changes into local data. The upload is read back and checked before local merged state is saved. A canceled merge or failed upload leaves local events unchanged. If local saving fails after upload, the cloud snapshot remains and the next sync can recover it.
- Local changes arriving during upload are retained and marked as needing another sync.
- Sync refuses malformed cloud data, incomplete listings, snapshots over 20 MB, more than 2,000 snapshots, or state exceeding 10,000 active events / 20,000 deletion records. It never prunes history automatically. Frequent use will eventually need history maintenance; export backups before any future maintenance.

Status reports the last completed check, not a guarantee that another device has no unsynced changes. Cloud snapshots consume Drive storage. They are not a substitute for independent dated backups, and can be removed through Google account/app-data management.

## Backups and local data

**Export JSON on each device before your first sync.** JSON is for restoration; CSV is for viewing in Excel and escapes formula-like text. Keep dated copies outside the browser. A download request cannot verify the file was saved.

Schema 3 JSON includes events, date precision, annual behavior, and timestamped deletion records. Version 1 and 2 backups remain importable. Import merges newer edits and deletions; an old backup does not silently resurrect a later deleted event. To undo a recent deletion, use **Restore previous local state**, which prompts before creating a new change restoring those events. The single undo point is replaced by the next save, import, or sync. It is not an independent backup.

The first 1.2.0 visit migrates existing events and their IDs into the atomic `milestones.state.v3` local-storage document. The older `milestones.events.v1` copy is retained but no longer updated. Do not downgrade and edit using older app versions after migration. Close older app tabs on each device. Cross-tab updates refresh the list and close editors to prevent stale saves; use one editing tab at a time.

Events remain accessible offline after the app shell has been cached. Browser/site-storage clearing, profile removal, or private-mode expiry can remove local data. Installing the PWA and hosting code on GitHub do not back up events. Personal events are never committed to GitHub. Other apps on the same `markz68.github.io` origin share a browser security boundary; deploy only code you trust.

## Publish and verify

Serve the files at repository root using GitHub Pages, branch **main**, folder **/(root)**. `.nojekyll` bypasses Jekyll. No local build or dependency installation is needed. Check the Actions deployment result rather than assuming a successful upload has published. If no build starts, resetting the Pages publishing branch from None back to main has worked for this repository.

After deployment, close old app tabs, reopen while online, and check **v1.2.2** in the footer. On each device connect the same Google account. Sync the PC first, then the phone, then the PC again. Test adding, editing and deleting a disposable event across devices. Test an offline edit followed by reconnecting and syncing. Independently exported backups should remain available throughout.

Google OAuth and real phone-to-PC sync need live testing on the user's devices; mocked API tests cannot establish that the configured Google account has granted access.

## Development and release history

Run `node --test tests.mjs sync-tests.mjs` for calendar dates, old/new backups, tombstones, deterministic conflicts, simultaneous first syncs, failures, pagination, verification and in-flight local edits. Serve over HTTP/HTTPS rather than `file://`. OAuth is authorized for the deployed HTTPS origin, not the local preview. Increment `CACHE` in `sw.js` when updating the app shell. Cache contains application assets only, not event backups or Google API responses.

- 1.0.0: local events, precision, backup/import, CSV and offline app shell.
- 1.1.0: phone readability and annual events with optional original dates.
- 1.1.1: expanded event icon picker.
- 1.2.0: manual Google Drive sync, deletion history, verified cloud snapshots and backward-compatible backup migration.

- 1.2.1: fixes browser fetch context during Google connection and adds **Check older local events** under Backup & restore. Recovery merges the retained pre-sync local copy after confirmation; it never clears local storage. If the old copy is absent, import a saved JSON backup. A report of a missing phone event remains unconfirmed as to cause; no assumption is made that migration, storage clearing, or Google sync caused it.

- 1.2.2: moves Add event into the timeline header and Google Drive sync / Backup & restore below the timeline near the footer, with full-width phone buttons.
