# Developing My Tasks

Technical notes for running My Tasks locally and finding your way around the code. For what the app is, see the [README](README.md).

## Run it

Requires Node 20 or later.

```bash
npm install
npm run dev      # local dev server: the app at http://localhost:5173/app/
npm test         # unit tests (Vitest)
npm run test:ui  # interface tests (Playwright): builds, then runs real browsers
npm run check    # type-check (svelte-check)
npm run build    # production build in dist/: the website, with the app in dist/app/
npm run preview  # serve dist/ as GitHub Pages does: website at http://localhost:4173/, app at /app/
```

The dev server serves only the app. To see the website, run `npm run build` then `npm run preview`.

The app shows only its Setup screen until it is connected to a GitHub Gist, so you need a personal access token (classic, `gist` scope) to get past it.

## Interface tests

`npm run test:ui` builds the app and runs `e2e/` in real browsers against it, served on port 4174 as `npm run preview` serves it (`playwright.config.ts`). Every test runs in desktop Chromium and desktop WebKit (close to Safari, the reference platform); `e2e/phone.spec.ts` runs in WebKit at iPhone size. They cover what the unit tests can't see: real IndexedDB transactions, Web Crypto, the Content Security Policy, the service worker, the website as served, and the phone layout.

- GitHub is faked: `e2e/fakeGitHub.ts` answers the browser's requests from the unit tests' `FakeGitHub`, so nothing reaches GitHub. Two browser contexts given the same `FakeGitHub` act as two devices sharing a gist.
- `e2e/app.ts` holds the shared steps: connecting through Setup, adding a task, and `watchErrors`, which collects uncaught errors and console errors, so a test can expect none.
- The first run needs the browsers: `npx playwright install chromium webkit`. They go in your user folder, so no admin rights are needed.
- `npx playwright test --project=chromium` runs one browser; `npx playwright show-report` opens the last report.
- **A change that a user can see or that touches the database gets an interface test**, alongside its unit tests.

## Tech

Svelte 5 and TypeScript, built with Vite. Data lives in IndexedDB through Dexie. Sync goes to the user's own GitHub Gist, encrypted in the browser with Web Crypto (PBKDF2-SHA-256 and AES-256-GCM). There is no server.

## Project layout

```
src/
  lib/model/    Types, dates, ids, ordering and the list membership rules (pure functions)
  lib/db/       IndexedDB schema (Dexie), all data operations (repo.ts), and
                transactions, the change log and undo (history.ts)
  lib/sync/     Sync through the user's GitHub Gist: setup, encryption, merging
  lib/drag/     Pointer-events drag and drop, and its pure calculations
  lib/pwa/      Install and offline: which browser, the install prompt, updates
  lib/state/    Live data, routing and transient UI state
  lib/          shortcuts.ts (key bindings), commands.ts (what they do),
                actions.ts (shared actions), version.ts (the version stamp)
                and csp.ts (the Content Security Policy)
  components/   Sidebar, rows, the task card, menus, dialogs, Setup
  views/        Built-in lists, project and area pages, Settings
site/           The website at the root of mytasks.fyi (plain HTML and CSS), copied
                around the app by the build; site/sw.js retires the old root service worker
scripts/        serve.mjs, the server behind npm run preview
tests/          Unit tests; tests/fakeGitHub.ts fakes the gist API
e2e/            Interface tests (Playwright); e2e/fakeGitHub.ts puts the same fake in the browser
```

## Data

- Every change runs in one IndexedDB transaction and is written to a local change log.
- Inside a transaction, Dexie loses track of it, and commits it too early (`PrematureCommitError`), in two cases:
  - awaiting a plain `async` helper before the first database request (load settings first);
  - a read awaited through two levels of `async` helpers more than once (for example a helper that calls a read helper, in a loop).
  So helpers that only read (`liveChecklist`, `siblingKeys`, `shiftedKey`, `loadSettings` in `repo.ts`) return Dexie's own promise with `then` and are not `async`. The unit tests' in-memory database does not show this; check multi-record operations in a browser.
- Records are never removed: a deletion sets `deletedAt`, so it syncs like any other change. A deleted record keeps only `id`, `deletedAt` and `modifiedAt` (a tombstone): delete with `bury` (`src/lib/db/bury.ts`), never by setting `deletedAt` yourself. Uploads and merges strip deleted records too (`src/lib/model/tombstone.ts`). Undo keeps its own full copy, so it can still restore a deleted record.
- Only read fields other than those three after filtering out deleted records.
- Sync merges record by record; the later `modifiedAt` wins. A `modifiedAt` later than now, from the gist or on this device, counts as now; the corrected copy is pushed and saved on this device. The merge records the time this device had for each row it writes (`seen` in `payload.ts`), and `applyRemote` writes a row only while the device still has that time, or when the row is later, so an edit made during a sync is never overwritten.
- This device's token, gist id and encryption key live in a separate database, `mytasks-device`, and never sync.
- Schema upgrades are per-record steps in `src/lib/db/migrations.ts`. Dexie's upgrade blocks in `database.ts` call them, and `upgradeList` uses the same steps for a list from an older version (a gist, or a backup file). **A new schema version adds its step there, a `this.version(n)` block, an entry in `STEPS`, and raises `SCHEMA_VERSION`.**
- Schema 5 (1.1.1) adds `collapsed` to headings (FR-2.7); areas already had it. Both sync like any field, and collapsing runs with `tx(…, { track: false })`, so it is never an undo step.
- `readLocal` (`src/lib/sync/local.ts`) reads every synced table and the settings in one read transaction, so uploads and backup files are one consistent snapshot.
- Once a device is connected, the app asks the browser to keep its storage (`navigator.storage.persist()`); the answer isn't shown.

## Sync

- Everything read from the gist or uploaded to it is checked first (`src/lib/sync/validate.ts`): every field of every record and setting, with its type; a missing or unknown field fails. Only a record's own fields count, and each rule must return exactly `true`. Dates must be real; timestamps must be exactly as `toISOString()` writes them; `sortKey` and `todaySortKey` must be keys fractional-indexing accepts. A record id or setting key appearing twice fails (`isPayload` in `payload.ts`). Deleted records are checked on `id`, `deletedAt` and `modifiedAt` only (anything else is dropped by the merge). **When you add a field to a record type in `src/lib/model/types.ts`, add it to `validate.ts` too**; `tests/checks.test.ts` builds every kind of record through the app and fails otherwise.
- The gist file must use 600,000 PBKDF2 iterations, a 16-byte salt and a 12-byte IV, and be at most 5 MB (`src/lib/sync/crypto.ts`); a longer file isn't fetched in full. A file that fails any check is never applied. Every create and write goes through `sealPayload` (`cycle.ts`), which refuses (`toolarge`) an encrypted file over 5 MB, so the gist keeps its last good file.
- New passphrases need at least 12 characters (`MIN_PASSPHRASE`); entering an existing one has no minimum.
- Syncs and the Settings actions (Change Token, Change Passphrase, Enter Passphrase, Recreate Gist) run one at a time across every open window, under one Web Lock (`src/lib/sync/lock.ts`); without Web Locks they still run one at a time within the window. Each one first reads this device's saved settings inside the lock (and makes them the window's copy), so it never uses settings another window has changed since; it does nothing if the device was disconnected.
- Change Token accepts a token only when the GitHub account it belongs to (`/user`) owns the gist; a token that can't reach the gist is refused too.
- Disconnect stops new syncs, takes the same lock (so it waits for a running one in any window), clears this device, then tells the other windows over a `BroadcastChannel`; they stop and reload to Setup.
- Every GitHub request, its answer included, has a 30-second limit (`REQUEST_TIMEOUT_MS`); no answer in time counts as offline, so the 15-second offline retries take over.
- A rate limit schedules the next try for just after its reset time (or GitHub's `Retry-After`, or a minute when it gives neither).
- The full text of a long gist file is fetched only from `https://gist.githubusercontent.com`.
- A list read from the gist (`checkList` in `cycle.ts`) from a newer schema is refused (`newer`); one from an older schema is upgraded with `upgradeList`, checked, and marked `upgradedFrom` (in memory only), so the merge pushes it back at the current schema.

## Back up and restore (FR-12.8)

- `src/lib/backup.ts` builds the file: a header (`format: "mytasks-backup"`, `formatVersion`, `schema`, `savedAt`, `appVersion`) and the same tables and synced settings as the gist, from `readLocal`. It is unencrypted, and holds nothing from `mytasks-device`. Saving needs no network. In the installed iPhone and iPad app it goes through the share sheet (`saveMethod`); everywhere else it is an ordinary download. Messages say "downloaded", never "backed up".
- `readBackup` checks a file completely before anything changes: at most 5 MB, the format marker, the format version and schema (older upgraded, newer refused), then `checkList`, the gist's own checks.
- `SyncEngine.restore` runs under the sync lock. It reads and opens the gist first (any error: nothing changes), builds the replacement (`replacement` in `payload.ts`: the backup's records and synced settings stamped now; a tombstone stamped now for every other id on the device or in the gist; defaults for synced settings the file lacks), and checks it with `sealPayload` (validation and 5 MB). Then `replaceLocal` writes the device in one transaction, reading its ids again inside it, and the gist is overwritten. If only that write fails, the device is restored and the next sync pushes it (`pending`). Restore clears the undo step. `tests/backup.test.ts` has the named test of this policy with two devices.

## Install and offline

`vite-plugin-pwa` writes the web app manifest and a Workbox service worker that precaches the whole app, so it opens with no connection. The icons are made at build time from `public/favicon.svg` (`pwa-assets.config.ts`). The service worker handles only the app's own files: requests to GitHub always go to the network.

The dev server has no service worker. To try install, offline or updates, run `npm run build` then `npm run preview`.

- **Install.** Chrome and Edge show their own install prompt; on Safari and in Firefox, Install My Tasks opens a guide with the steps. In a Safari tab, the sidebar warns that data can be cleared, because Safari clears a site's storage after 7 days unused unless it is installed.
- **Updates.** The app checks for a new version on start, hourly, and when you switch back to it. A new version installs in the background and waits. The "Update available" banner's Restart saves any edit in progress, then switches; nothing reloads by itself.
- **Title bar.** The `theme-color` tags in `index.html` give the installed window the sidebar's grey; `src/lib/theme.ts` keeps them in step with Appearance.

## Keyboard

Press `?` in the app for the full list. Installed, My Tasks uses the full shortcuts, including Cmd/Ctrl chords. In a browser tab, keys the browser keeps for itself (Cmd/Ctrl+N, T, R and others) are replaced by single-letter fallbacks, and `/` opens Quick Find.

## Hosting and security

My Tasks is served as static files from GitHub Pages: the website at https://mytasks.fyi and the app at https://mytasks.fyi/app/. Every push to main runs `.github/workflows/deploy.yml`: `npm audit --omit=dev` (known vulnerabilities in the packages the app ships), unit tests, type check and build, then publish `dist/`. A second job, `interface`, runs the interface tests in Chromium and WebKit, and keeps Playwright's report for 7 days when one fails. A failing step in either job stops the deploy. Pull requests run both jobs, without publishing, so the PR page shows whether they pass. `site/CNAME` names the domain.

- **Permissions.** The workflow can only read the repo; only the deploy job can publish to Pages (`pages: write`, `id-token: write`).
- **Pinned actions.** Each action is pinned to a full commit hash, with its version in a comment, so a moved tag can't change what runs.
- **Dependabot** (`.github/dependabot.yml`) opens one grouped pull request a month for npm packages and one for GitHub Actions, and updates the pinned hashes. Test and merge them like any other pull request. Major TypeScript updates are ignored until `svelte-check` accepts TypeScript 7; remove that rule from `dependabot.yml` when it does.

The domain is where each device keeps its data (the browser's storage belongs to the site's address, not its path), so it must never change. The app moved from the root to `/app/` in 0.5.0 on the same domain, so every device kept its data. Two files keep earlier installs working:

- `site/sw.js` replaces the old root service worker: it deletes that worker's caches (not the app's), unregisters it and reloads open pages.
- `site/assets/site.js`, on the home page, forwards old links (`mytasks.fyi/#/today`) to the app, and sends an app installed before the move, which still starts at the root, straight to `/app/`.

The app links to the website from Setup, the sidebar's ? button, Settings › About My Tasks and the version stamp (the Roadmap page), always in a new tab (`src/lib/website.ts`, `SiteLink.svelte`): opened inside an installed app, the website's home page would send it straight back to `/app/`. Setup won't connect until the user ticks that they have read the risks and limitations; this device records when, and the Limitations page's "Last updated" date (`LIMITATIONS_UPDATED`). **When the Limitations page changes, update its date and `LIMITATIONS_UPDATED` together**; `tests/website.test.ts` checks they match.

The website has its own, stricter policy (`SITE_CSP` in `src/lib/csp.ts`): its own scripts and styles only, nothing inline, and no connections. `tests/website.test.ts` checks every page for it, the shared header and footer, and every link.

The built page carries a strict Content Security Policy in a `<meta>` tag (`src/lib/csp.ts`, added by `vite.config.ts`): scripts only from the app, no `eval`, and no connections except the app and GitHub's gist API. GitHub Pages can't send headers, so `frame-ancestors` and violation reports are not available. Instead, the app checks whether it is inside a frame when it starts (`src/lib/framed.ts`); if so it starts nothing and shows a message with a link that opens it on its own. The dev server leaves the policy out, because it needs its own live-reload connection; `npm run preview` serves a build with it.

## Versions

The app shows its version and commit at the bottom of the sidebar and on Setup, for example `v0.2.0 (a1b2c3d)`, and links it to the website's [Roadmap](https://mytasks.fyi/roadmap/) page. 1.0.0 (2026-11-13) was the first release at mytasks.fyi. From Milestone 8, the first pull request in a milestone that changes the app raises the middle number (1.1.0), and later ones in the same milestone raise the last number (1.1.1); the first number changes only for a major release, such as v2.0 on the Roadmap.

Release steps for each pull request that changes the app:

1. Set the version in `package.json`: the middle number for the milestone's first pull request that changes the app, the last number for later ones.
2. Add a section to [CHANGELOG.md](CHANGELOG.md).
3. When a milestone completes or a planned feature changes, update the Roadmap page (`site/roadmap/index.html`) and its "Last updated" date in the same pull request.

The website names a version only on the Roadmap page (`tests/website.test.ts`).

The commit is read when the dev server starts or the app is built, so restart `npm run dev` after switching branches.

## Milestones

v1 is built in milestones, each a pull request.

| Milestone | Scope | Status |
| --- | --- | --- |
| 1 | Data model, sidebar, the seven lists, tasks, areas, projects and headings | Done |
| 2 | Tags, When and deadline pickers, checklists and notes, priority and its automatic rules, Settings | Done |
| 3 | Saved searches, Today grouping, search and Quick Find, Quick Entry | Done |
| 4 | Drag and drop, keyboard shortcuts, undo | Done |
| 4a | Area ⋯ menu, contexts, project link under the open card | Done |
| 4b | Task right-click menu | Done |
| 5 | 5a Completed list and subtitle; 5b themes; 5c when completed items move; 5e encrypted gist sync; 5f install and offline; 5g hosting at mytasks.fyi | Done |
| 6 | Finishing touches: 6a fixes (keys typed right after N, final Empty Trash); the website and the Setup acknowledgment (0.5.0, 0.6.0); the Roadmap page and "tasks" wording (0.7.0) | Done |
| 7 | Ready for release (1.0.0): the security and privacy review and its fixes (0.7.1 to 0.9.1); back up and restore (0.10.0) | Done |

Milestones 8 to 12 (v1.1 to v2.0) are on the website's [Roadmap](https://mytasks.fyi/roadmap/) page.
