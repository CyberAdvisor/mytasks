# Changelog

What changed in each version of My Tasks. The app shows its version at the bottom of the sidebar and on the Setup screen; clicking it opens the [Roadmap](https://mytasks.fyi/roadmap/), which shows what's planned.

Versions follow [Semantic Versioning](https://semver.org). 1.0.0 was the first release at mytasks.fyi. From Milestone 8, the first change to the app in a milestone raises the middle number (1.1.0) and later ones the last number (1.1.1); the first number changes only for a major release, such as v2.0 on the Roadmap. Each pull request that changes the app adds its section here and sets the version in `package.json`. The format follows [Keep a Changelog](https://keepachangelog.com).

<a id="v1.1.2"></a>

## 1.1.2 — 2026-11-14

A sidebar you can resize.

### Added

- Drag the sidebar's right edge to make it wider or narrower, from 200 to 400 pixels. Double-click the edge to put it back to its usual width. Each device remembers its own width. On iPad the edge can be dragged with a finger; phones show the lists full screen, so there is nothing to resize. (#46)

<a id="v1.1.1"></a>

## 1.1.1 — 2026-11-14

Collapsible areas and headings.

### Added

- An arrow beside each area in the sidebar hides or shows its projects, and one beside each heading in a project hides or shows its tasks. A collapsed heading shows how many open tasks it holds. The arrow beside an area shows when you point at it, and stays while the area is collapsed. Your other devices keep the same areas and headings collapsed. (#45)
- Adding a task with a collapsed heading's + opens the heading first. (#45)

### Changed

- Your tasks are saved in a new format (schema 5), which upgrades by itself. A device still on 1.1.0 shows "Update needed — reload the app" after another device has synced 1.1.1. (#45)
- The Roadmap page shows calendar events from your Mac as Milestone 9 (v1.2) and sequential projects in Milestone 8; Power editing, Your data and Sharing are now Milestones 10 to 12. The comparison tables show calendar events as Planned. (#45)

<a id="v1.1.0"></a>

## 1.1.0 — 2026-11-14

The new logo.

### Changed

- The logo is now an M whose last stroke rises into a check, in coral, in place of the blue placeholder. It follows the Light or Dark appearance in the app, and the system's appearance in the browser tab. The app icons and the website's logo and tab icon change with it. (#44)
- An installed app may keep its old icon until it is removed and installed again. Your tasks are safe: they stay in your gist. (#44)

<a id="v1.0.0"></a>

## 1.0.0 — 2026-11-13

The first release. My Tasks is ready for use, within its [risks and limitations](https://mytasks.fyi/limitations/) and the features on the [Roadmap](https://mytasks.fyi/roadmap/) that aren't built yet.

### Changed

- The README and the website no longer describe My Tasks as in active development. The Limitations page's first item is now "Bugs and features still to come", and suggests saving a backup file from time to time. (#41)
- Milestone 7 is complete. Its three unbuilt items (a full design check with iPhone and iPad testing; the website's About page and self-hosting guide; a way to follow updates) moved to Milestone 8 (v1.1) on the Roadmap. (#41)

<a id="v0.10.0"></a>

## 0.10.0 — 2026-11-13

Back up and restore.

### Added

- **Save Backup** in Settings › Backup downloads a file of your tasks, projects, areas, tags, contexts, saved searches and synced settings. It works whatever state your gist is in, and never holds your token, passphrase or gist connection. The file is not encrypted. On iPhone and iPad, the installed app saves it through the share sheet. (#40)
- **Restore from Backup…** replaces all your tasks with a backup file's, on this device, in your gist and, once they sync, on your other devices. The whole file is checked first, and the confirmation says what will happen and offers to save a backup first. Restore can't be undone. (#40)
- My Tasks asks the browser to keep its storage, rather than clear it when space runs low. (#40)

### Changed

- A gist saved by an older version of My Tasks is upgraded when it's read, and saved back in the current format. (#40)
- Uploads and backup files are taken as one consistent copy of your tasks, even while another window is making changes. (#40)

<a id="v0.9.1"></a>

## 0.9.1 — 2026-11-13

Follow-ups from the second look at the security review.

### Fixed

- A window left open while another changed the passphrase or token now uses the new settings, so its own Change Token can no longer put the old ones back. (#39)
- Tasks too large to upload (an encrypted file over 5 MB) are never uploaded. Your gist keeps its last good file, your changes stay on this device, and Settings explains it. (#39)
- A device whose clock ran fast now has its own changes' times corrected too, on the device and in your gist, without losing an edit made during the sync. (#39)
- The checks on your gist are stricter: only real dates and times, written the way My Tasks writes them; only valid ordering keys; no task, record or setting twice. (#39)
- Change Token accepts only a token from the GitHub account that owns your gist. (#39)
- Error messages in the Settings sync dialogs are red, as in Setup. (#39)
- The Limitations page says more precisely when changes made on two devices are kept. (#39)

<a id="v0.9.0"></a>

## 0.9.0 — 2026-11-13

The fourth fixes from the security review.

### Changed

- Every task, project, area, heading, checklist item, tag, context, saved search and setting in your gist is checked field by field before it's used, and so is everything this device uploads. A file that fails isn't applied, and your tasks on this device are unchanged. (#38)
- A gist file must use My Tasks' own encryption settings and be at most 5 MB; anything else isn't applied. (#38)
- New passphrases need at least 12 characters, with a tip to use a password manager or four random words. Passphrases you already use keep working. (#38)

<a id="v0.8.0"></a>

## 0.8.0 — 2026-11-13

The second fixes from the security review.

### Changed

- Deleting keeps nothing of what was deleted: Empty Trash, Delete Immediately, and deleting a heading, area, tag, context, saved search or checklist item keep only an id and the time, on your devices and in your gist. Undo still brings back something you just deleted. (#33)
- Empty Trash also removes the headings of projects it empties. (#33)
- Things deleted before this version are cleaned once when the app updates, and your gist is cleaned at the next sync. Earlier versions of the gist stay in its history on GitHub. (#33)
- A device whose clock runs fast can no longer have its changes win every sync: times from the gist later than now count as now. (#33)
- Devices still on 0.7.1 ask you to reload once another device has synced with 0.8.0. (#33)

<a id="v0.7.1"></a>

## 0.7.1 — 2026-11-13

The first fixes from the security review.

### Fixed

- Disconnect waits for a sync that's running, in this or another open window, before it clears this device, so the sync can no longer save the connection back. Other open windows stop syncing and return to Setup. (#32)
- Syncing and the Settings actions (Change Token, Change Passphrase, Enter Passphrase, Recreate Gist) run one at a time, across every open window. A sync can no longer upload your tasks under the old passphrase just after Change Passphrase. (#32)
- When GitHub limits requests, sync tries again by itself just after the limit ends. (#32)
- A request to GitHub that gets no answer within 30 seconds now shows as Offline, and sync keeps trying. (#32)
- Long gist files are read only from gist.githubusercontent.com. (#32)

### Changed

- The app won't run inside another web page. It shows a short message with a link that opens it on its own. (#32)

<a id="v0.7.0"></a>

## 0.7.0 — 2026-11-13

### Added

- A [Roadmap](https://mytasks.fyi/roadmap/) page on the website: what's planned, by milestone and version, with completed milestones at the bottom. The website's footer links to it instead of the changelog. (#31)

### Changed

- The version at the bottom of the sidebar and on Setup opens the Roadmap page. (#31)
- The app and website say "tasks" instead of "to-dos": for example, New Task, Duplicate Task and Delete Task. Nothing is renamed in your data. (#31)
- The website's comparison with Things 3 and Todoist is longer and up to date. (#31)

<a id="v0.6.0"></a>

## 0.6.0 — 2026-11-12

### Added

- Setup asks you to confirm you've read the [risks and limitations](https://mytasks.fyi/limitations/) before connecting, and links to the website. Devices already connected aren't asked. (#30)
- A ? button at the bottom of the sidebar opens the website, and Settings › About My Tasks links to its guide, limitations, privacy and security pages. (#30)

<a id="v0.5.0"></a>

## 0.5.0 — 2026-11-12

### Added

- A website at [mytasks.fyi](https://mytasks.fyi): what My Tasks is, its risks and limitations, a guide, and how it handles your privacy and security. (#29)

### Changed

- The app moved to [mytasks.fyi/app](https://mytasks.fyi/app/). Your list stays on your devices: nothing to reconnect. Old links and apps installed before the move open the app at its new address. (#29)

<a id="v0.4.2"></a>

## 0.4.2 — 2026-11-12

### Fixed

- Duplicate Project no longer fails when the project's to-dos have no checklist. Before, the copy was made but could not be undone, and it was not synced until the next change. (#27)

<a id="v0.4.1"></a>

## 0.4.1 — 2026-11-12

### Fixed

- Keys typed right after New To-Do (N, Space or Cmd+N) go into the new to-do's title. Before, the first few were lost or ran as commands. (#25)
- Empty Trash is final, as its confirmation says: Cmd+Z no longer brings the items back. On touch devices, an Undo toast still showing is hidden. Empty Trash also no longer fails with an error when the Trash holds several items. (#25)

<a id="v0.4.0"></a>

## 0.4.0 — 2026-11-12

### Added

- My Tasks is published at [mytasks.fyi](https://mytasks.fyi). Every change merged to main is tested, built and published automatically. (#23)

### Security

- A strict Content Security Policy: the app runs only its own scripts, never `eval`, and connects to nothing but itself and GitHub's gist API. (#23)

<a id="v0.3.0"></a>

## 0.3.0 — 2026-11-12

### Added

- My Tasks installs as an app and opens with no connection. Every file it needs is kept on the device. (#22)
- Install My Tasks at the bottom of the sidebar in Chrome, Edge and Firefox. In Chrome and Edge it opens the browser's install prompt; in Firefox it explains that Firefox can't install web apps. (#22)
- In a Safari tab, on iPhone, iPad or Mac, the sidebar warns that Safari clears a tab's data after 7 days unused, with a link to the install steps. (#22)
- On iPhone and iPad, Setup asks you to install My Tasks first, because the Home Screen app keeps its own data, separate from Safari. (#22)
- When a new version is ready, an "Update available" banner offers Restart. The app checks for a new version when you switch back to it. Restart saves what you're typing first; the app never reloads by itself. (#22)
- App icons for the Home Screen, Dock and taskbar, made from the logo. (#22)

### Changed

- The installed app's title bar is the sidebar's grey, light or dark with the theme, instead of blue. (#22)

<a id="v0.2.2"></a>

## 0.2.2 — 2026-11-12

### Changed

- The README now describes what My Tasks is: free, private and secure, with a screenshot of Today and a comparison with Things 3 and Todoist. It warns that the app is a work in progress and not yet for important data. The technical notes and milestone table moved to DEVELOPMENT.md. (#21)

<a id="v0.2.1"></a>

## 0.2.1 — 2026-11-12

### Fixed

- After the network came back, the sidebar kept saying Offline until the next change or Sync Now. While offline, the app now tries again every 15 seconds. (#19)

<a id="v0.2.0"></a>

## 0.2.0 — 2026-11-12

### Added

- The version and commit of the build, for example `v0.2.0 (a1b2c3d)`, beside the sync status at the bottom of the sidebar and on the Setup screen. It links to this changelog. (#18)

### Changed

- The subtitle is now "Plan. Do. Succeed." (#18)
- The sync status at the bottom of the sidebar keeps the last sync time on one line, beside the version. Being offline or a sync problem now shows on its own line above it. (#18)

<a id="v0.1.0"></a>

## 0.1.0 — 2026-11-12

Everything built before versioning started (#1 to #17):

- Milestones 1 to 4: the data model, the sidebar and its lists, to-dos, areas, projects and headings; tags, When and deadline pickers, checklists, notes, priority and its automatic rules, Settings; search, Quick Find, saved searches, Today grouping and Quick Entry; drag and drop, keyboard shortcuts and undo. (#1 to #5)
- Area ⋯ menu and blue menu icons, contexts on to-dos, and the project link under the open card. (#7 to #9)
- Logbook renamed Completed (#10); light and dark themes (#11); Today's sidebar counts add up to the list (#12); when completed items move to Completed (#13).
- The user's GitHub Gist as the data store, encrypted with a passphrase. (#14)
- The to-do right-click menu, as in Things. (#15)
- Move to Completed moved from a header button into the ⋯ menus, and Today's grouping moved from a bar into its ⋯ menu. (#16, #17)
