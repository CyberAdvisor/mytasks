# My Tasks

**Plan. Do. Succeed.**

A better task manager that is **free**, **private** and **secure**. My Tasks gives you a calm, focused way to plan your work, on every device you own, without a subscription or an account with us.

**Website:** [mytasks.fyi](https://mytasks.fyi) · **Open the app:** [mytasks.fyi/app](https://mytasks.fyi/app/) · **Guide:** [mytasks.fyi/guide](https://mytasks.fyi/guide/)

> [!NOTE]
> **Ready for use, within its limitations.** Please read the [risks and limitations](https://mytasks.fyi/limitations/) before you rely on it.

![The Today list in My Tasks, with tasks from several projects, their contexts, deadlines and priorities](docs/images/today.png)

## Why My Tasks

**Free, for good.** Every feature, on every device, at no cost. No trial, no paid tier, no limits on projects or lists. My Tasks is open source under the MIT license.

**Private by design.** There is no My Tasks server and no My Tasks account. Your tasks live on your devices and in your own GitHub account, and nowhere else. No analytics, no tracking, no ads.

**Secure.** Before your tasks leave a device, they are encrypted with a passphrase that only you know, so the copy in your GitHub account can't be read without it. GitHub can see that the gist exists, its size and when it changes. The app doesn't store your passphrase or send it anywhere. See [Security](https://mytasks.fyi/security/) for what My Tasks can't protect against.

**On every device.** It runs in any modern browser on iPhone, iPad, Mac, Windows, Linux and Android, and installs like an app on each of them. Your tasks keep working without a connection, and your devices stay in step whenever they're online.

**Familiar.** Inbox, Today, Scheduled, areas, projects, headings and checklists work the way users expect, with familiar keyboard shortcuts where the browser allows.

## How it compares to other popular task managers

|  | **My Tasks** | **Things 3** | **Todoist** |
| --- | :---: | :---: | :---: |
| **Price** | Free | $49.99 Mac, $19.99 iPad, $9.99 iPhone, one-time | Free for 5 projects; Pro $5 a month yearly, or $7 monthly |
| Open source | ✅ | — | — |
| Your data is end-to-end encrypted | ✅ | — ¹ | — ¹ |
| iPhone, iPad and Mac | ✅ | ✅ | ✅ |
| Windows, Linux, Android and the web | ✅ | — | ✅ |
| Works offline | ✅ | ✅ | ✅ |
| Areas, projects and headings | ✅ | ✅ | Projects and sections |
| Checklists | ✅ | ✅ | Sub-tasks |
| Tags | ✅ | ✅ | ✅ |
| Priorities | ✅ 5 levels | — | ✅ 4 levels |
| Contexts | ✅ | — | — |
| Saved searches | ✅ | — | ✅ Filters |
| Repeating tasks | Planned | ✅ | ✅ |
| Typed dates ("next fri") | Planned | ✅ | ✅ |
| Calendar events with your tasks | Planned | ✅ | Pro |
| Reminders and notifications | — ² | ✅ | ✅ |
| Board (Kanban) view | — | — | ✅ |
| Sharing with others | — | — | ✅ |
| Markdown in notes | — | ✅ | ✅ |
| Widgets, Siri and Apple Watch | — ² | ✅ | ✅ |

¹ Things and Todoist encrypt your data on their servers, but they hold the keys, so the company could read it.

² Not possible for a web app without a server, so My Tasks leaves these out.

Comparison as of November 2026. Prices are in US dollars and can change.

## How it works

1. Open [mytasks.fyi/app](https://mytasks.fyi/app/) in your browser and install it: to your Home Screen on iPhone and iPad, to the Dock from Safari on a Mac, or with Chrome's or Edge's install button. The app shows you how.
2. Confirm you've read the [risks and limitations](https://mytasks.fyi/limitations/), connect it to your free GitHub account with a token (the app shows you how), and choose a passphrase.
3. My Tasks creates a secret, encrypted gist in your account to hold your tasks. Connect your other devices with the same token and passphrase, and they all stay in step.

Every device keeps its own working copy, so the app is fast and works without a connection. Changes are encrypted and sent to your gist a moment after you make them. You can also save a backup file of your tasks in Settings and restore it later.

## Status

My Tasks is being built in milestones, one pull request at a time. The core of the app is done: lists, projects, tags, priorities, contexts, search, drag and drop, keyboard shortcuts, themes, encrypted sync, installing as an app that works fully offline, and hosting at [mytasks.fyi](https://mytasks.fyi), with its website. See the [Roadmap](https://mytasks.fyi/roadmap/) for what's planned, and [CHANGELOG.md](CHANGELOG.md) for what has changed so far.

The version you're using is shown at the bottom of the sidebar. Click it to open the Roadmap.

## Contributing

My Tasks is open source under the [MIT license](LICENSE). To run it locally or find your way around the code, see [DEVELOPMENT.md](DEVELOPMENT.md).
