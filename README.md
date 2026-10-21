# Milestones 1.1.1

A personal countdown and elapsed-time app for markz68. A responsive event list opens into event details. Dates can be exact, month/year, or year-only. Partial dates remain partial in storage, backups, and exports. Approximate time is labeled accordingly.

## Included

- Create, edit, delete, search, pin, sort, and filter events.
- Notes, categories, icons, and date sources.
- Browser-local storage with explicit save failures.
- JSON export and validated, non-destructive merge import; the newest edit wins for matching IDs. Missing events are added. Import does not delete events, and importing an older backup can bring back previously deleted events.
- CSV export for Excel. CSV is for reading, not restoration. Formula-like text is escaped.
- One local undo point, including deletion recovery until another change.
- Offline app shell after an initial successful HTTPS visit and service worker installation. Calendar-day calculations use the device's local date and UTC arithmetic to avoid DST shifts.

## Publish with GitHub Pages

1. Create a repository named `milestones` under `markz68`. Use a public repository if required by your GitHub plan for Pages. The source code can be public; do not commit event backups or other personal data.
2. Upload this folder's contents to the repository root, including `.nojekyll` and the files ending in `.mjs`. Do not nest them inside another `milestones` directory.
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/(root)**, and Save.
4. GitHub should provide the deployment URL, expected to be `https://markz68.github.io/milestones/`. Wait for GitHub to confirm a successful deployment before relying on the URL.
5. Open that URL in your regular browser, add a test event, reload, export a JSON backup, and verify the download. Import a copy into another browser to test restoration.

The app may be added to a home screen when supported by the browser. No package installation, build step, external libraries, API keys, or Google account is required for this version.

## Data ownership and current limitations

**Google Drive sync is not implemented in version 1.1.0.** Each browser/device has a separate set of events. To move between devices, export a JSON backup and import it on the other device. Browser data can be lost if site storage is cleared, the browser profile is removed, or a private browsing session ends. A website deployment or GitHub repository does not back up your events.

JSON preserves event ID, title, date, precision (`day`, `month`, or `year`), icon, category, notes, source, pin status, and edit timestamp. Keep multiple dated backup copies outside the browser. The app can initiate a download but cannot verify that you actually saved it. The local undo point is not an independent backup. Editing in another tab refreshes the list and closes open editors to reduce stale overwrites; use one editing tab at a time.

The “Upcoming” filter includes an uncertain event whose month/year contains today. It cannot know whether that event has already happened. No dates are prefilled or inferred from emails. Images, native Android widgets, and notifications are not included in this release.

No personal event data is sent to GitHub by this app. GitHub serves the public app files and receives ordinary hosting requests. Other project pages on the same `markz68.github.io` origin share a browser security boundary; only deploy code you trust there.

## Development

Serve the repository over HTTP/HTTPS rather than opening `index.html` directly as a file. Run `node --test tests.mjs` for date and backup validation checks. The browser script is a native ES module.

For future app-shell updates, increment `CACHE` in `sw.js` and update the cached file list. Offline cache stores application files only. New service workers activate after older app tabs close.

## Annual events (1.1.0)

Choose one-time, annual with an original date, or annual without a start year in the editor. A marriage/birthday uses one record for the original date, elapsed time, and next annual occurrence. It appears in Upcoming and also in Past after its original date. Holidays store only MM-DD with precision `annual`, never an invented origin year. Birthdays use the general “N-year anniversary” wording for now. Annual events with only an original month/year retain approximate month counts. Year-only events must have a known month before annual repetition can be enabled. February 29 uses February 28 in non-leap years, stated in the editor and details. These are fixed calendar repeats; floating holidays are not supported.

Schema 2 backups include `repeat` (`none`, `origin`, `annual`) and support the new `annual` precision. Version 1 backups remain importable. Use version 1.1.0 or newer to restore version 2 backups. Existing browser data and IDs are preserved in place. The phone layout uses larger text, controls, and stacked event rows.

Version 1.1.1 adds wedding rings, Christmas, globe, vacation, graduation, retirement, vehicle, and maintenance icons. Icons do not change event timing or date precision.

Release 1.1.1 includes the expanded icon picker. The footer identifies the version currently served by GitHub Pages.

Personal milestone tracker.
