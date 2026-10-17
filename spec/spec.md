# Wardrobe Manager: Product & Technical Spec

Oct 10, 2026 · @Frankie

## Overview

Wardrobe Manager helps decide what earns a place back on the rail for autumn and winter, and stops the rail being overfilled. The starting point is empty rails, a pile of clothes, and a physical limit in inches. The app turns that limit into a live count.

**The idea that makes it different.** Most wardrobe apps chase gaps and encourage owning more. This one starts from a ceiling: one item per inch of hanging space, so everything hangs separately and the wardrobe stays easy to see. "Well rounded" means the right mix of types *inside* that ceiling.

**First job:** the autumn and winter reset. Catalogue the pile, decide what goes back, and see what is still missing within the rails' capacity. It is a personal tool first and a deliberate product exercise second, so it is built for one real user with seams for others.

**Goals**

- See at a glance how full each rail is against its capacity in inches.
- Decide how many of each category deserves a slot, then sort the pile against those targets.
- Record fit honestly, including the middle ground of "keep for now, replace when I find one".
- Install on a phone, work offline, keep data on the device, host free on GitHub Pages.
- Stay extensible: other seasons, other storage, other people.
- Keep the app itself static and data-storing-nothing-remotely; put the clever setup help in separate Claude skills instead, handing off through CSV.

**Not in the first release:** shoes, loungewear, gym wear and nightwear (stored in containers, not on rails), photos, outfits, colour balance, selling tools, and spring and summer planning.

## The rails

The core of the app is three hanging rails, each with an inch capacity. One item takes one inch. That is a wellbeing rule rather than a measurement: some items are slimmer, but one inch each means everything hangs separately.

| Rail | Capacity | Default categories |
| --- | --- | --- |
| Short | 78 in | Shirts, tops, light jumpers, trousers |
| Medium | 60 in | Skirts, short dresses, suits and jackets, cardigans, bulky jumpers |
| Long | 20 in | Long dresses, coats |

The total capacity is 158 inches. Trousers sit on the short rail because they hang folded over it.

**Rules**

- Every category has a default rail. An item can override it, but that is rare: the user hangs by category, so all cardigans go on the medium rail even when some are short.
- Capacity and inches per item are settings, not code. The defaults are 78, 60 and 20 inches, at 1 inch per item.
- A rail's used inches are its on-rail items multiplied by inches per item.
- A rail is either within capacity or over. Over is a warning showing how many inches, never a block, because the aim is not to go too far over rather than to forbid it.
- Only on-rail items count. Items in the pile, stored or archived use no inches.

**Out of scope for now:** shoes and folded or boxed items (loungewear, gym wear, nightwear). The model allows other kinds of storage later (see Data model), but v1 has rails only.

## A sorting session

The app supports the activity happening right now: a pile of clothes, empty rails, and a decision about each item.

1. **Set up the rails.** Confirm the rail capacities and set a target count per category (its allocation). Targets are a guide, not a rule that must sum to capacity exactly — they can add up to less or more than it, whatever feels sensible for that category, and the rail warns rather than blocks if they run over.
2. **Catalogue the pile.** Add each item with category, seasons and fit. Quick-add keeps the last category and seasons so a run of similar items is fast. New items start in the pile.
3. **Sort by category.** The category screen shows target, on rail and in pile. For each pile item, choose **Put back**, **Not now** (stored) or **Let go** (archive). The counts update live and warn when a category target or a rail capacity is passed.
4. **Read what is missing.** A category with fewer on-rail items than its target shows how many are still needed. That is the shopping list.
5. **Review the replace list.** Items marked "fits, but replace" stay on the rail and also appear here, so a so-so item is never silently fine forever.

**Example.** The medium rail holds 60 inches. Cardigans have a target of 8 and the pile has 11. The user puts back 8, and the other 3 go to Not now or Let go. The medium rail shows 8 more inches used, and cardigans show on target.

The session is not a one-off screen: the same sorting view serves any later reshuffle, such as swapping in a new item and moving an old one out.

## Items, states and fit

Two things are tracked separately: where an item is (its state) and how well it fits (its fit).

| State | Meaning | Uses rail inches? |
| --- | --- | --- |
| Pile | Out of the wardrobe, not yet decided | No |
| On rail | Hanging in the wardrobe now | Yes |
| Stored | Kept but not on the rail, for example another season | No |
| Archived | Let go (sold, donated or binned), kept as history | No |

| Fit | Meaning | Effect |
| --- | --- | --- |
| Fits well | Happy to wear | Counts as normal |
| Fits, replace when I can | Wearable but not ideal, such as a decent work shirt with no replacement yet | Counts as normal and appears on the replace list |
| Doesn't fit | Not wearable now | The sorting view suggests Let go but never forces it |
| Not checked | Default | Counts as normal |

**Replace list.** Items flagged "replace when I can" are grouped by category. It is effectively a shopping search kept in the app, so a keep-for-now item both fills a slot today and stays visible as something to replace. When a replacement arrives, the old item is archived.

**Archive as history.** Archived items disappear from the rails and counts but stay searchable by name, brand and size, and keep the fit they had. That gives a manual sizing memory: for example, that one brand's size 10 jeans fit well, and which things did not fit. v1 does not suggest anything automatically; it is searchable history only. Archiving records an optional reason (sold, donated, other).

**Seasons.** Each item has one or more of autumn, winter, spring, summer, or all-year. The current plan covers autumn and winter, so the sorting view only offers items tagged with either of those or all-year; items tagged purely spring or summer stay hidden rather than appearing early. Swapping seasonal items in and out is deliberately left until it has been lived through, since it is not a like-for-like swap.

## Data model

The model keeps v1 small while leaving room to grow: capacity lives on zones, and everything season-specific lives on a plan.

**Item**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | UUID | yes | Generated on the device. |
| name | string | yes | For example "Navy wool cardigan". |
| category | category id | yes | One of the built-in categories. |
| state | enum | yes | pile (default), on-rail, stored, archived. |
| fit | enum | yes | fits-well, fits-replace, doesnt-fit, not-checked (default). |
| seasons | enum\[\] | yes | At least one of autumn, winter, spring, summer, all-year. Carried over in quick-add. |
| brand, size, material, colour | string | no | Free text. Brand and size power the archive history and the copy-details button. |
| notes | string | no | Free text. |
| zoneOverride | zone id | no | Only when an item hangs somewhere other than its category's default rail. |
| archivedReason | enum | no | sold, donated, other. Set when state becomes archived. |
| archivedAt, createdAt, updatedAt | ISO timestamp | yes | Set by the app. |

**Other records**

- **Zone:** id, name, kind (rail in v1), capacity, unit (inch in v1), order. Three zones ship: Short 78, Medium 60, Long 20. A shelf or drawer zone could later use a count unit.
- **Category:** id, name, default zone. Eleven ship: shirts, tops, light jumpers, trousers, skirts, short dresses, suits and jackets, cardigans, bulky jumpers, long dresses, coats. A suit counts as one item on one hanger, not one per piece. Categories, their names and their default zone are user-editable, since what someone needs to track depends on what they wear.
- **Plan:** id, name (for example "Autumn and winter 2026"), seasons, inches per item, and allocations (a target count per category). v1 has one active plan; the model allows a spring and summer plan later with no migration.
- **Settings:** theme, last backup date, schema version.

**Derived, never stored.** Zone used inches and status; per category: on rail, in pile, needed (target minus on rail, never below zero) and surplus (on rail minus target, never below zero).

**Backup file.** One JSON document: `{ schemaVersion, exportedAt, items, zones, categories, plans, settings }`. Any change to the shape bumps `schemaVersion` and ships with a migration, so old backups keep importing.

## Screens

A bottom tab bar for one-handed phone use: **Rails**, **Sort**, **Add** (centre), **Items**, **Settings**.

| Screen | Purpose | Key elements |
| --- | --- | --- |
| Rails (home) | See how full the wardrobe is | Three gauges (used of capacity, inches free or over), categories under each rail with on rail versus target |
| Sort | Decide what goes back | Category header with target, on rail and in pile; pile items with Put back, Not now and Let go; live warnings |
| Add item | Catalogue the pile quickly | Name, category, seasons, fit; optional extras folded away; Save and add another |
| Items | Find anything | Search over name, brand, size and notes; filters for category, state, season and fit; archived items behind a toggle |
| Replace list (phase 2) | Track what to find | Items flagged replace-when-I-can, grouped by category |
| Settings | Set up the rails and look after data | Rail capacities, inches per item, category targets, JSON export and import, CSV import for rails, categories and items (from a Claude skill or a spreadsheet), install help, version |

**First run.** A short note that data stays on the device, then rail capacities (defaults pre-filled), then category targets, then straight into Add item.

**Backup.** Settings, Export, which downloads `wardrobe-backup-YYYY-MM-DD.json`. Import previews the counts (items, zones, plans) before the user chooses merge or replace.

## Claude skills

The app itself stays deliberately dumb: static HTML, no backend, no account, data stored only on the device. The intelligence for getting set up lives outside it, as two Claude skills the user runs separately. Skills talk to the user in conversation and hand off a CSV; the app never calls out anywhere.

**Wardrobe setup skill.** Talks through the user's life and wardrobe — what they wear, for what, how often — and helps them land on their own categories and a target count per category, rather than starting from the eleven defaults cold. Output is a categories file, plus an optional rails file with the rail capacities, that the user imports into the app.

**Add-to-wardrobe skill.** The user describes an item in a sentence or two; the skill looks the item up where possible (brand, material, colour, typical sizing) to fill in fields the user didn't give, and appends a row to a CSV. Several items can be described in one session. The CSV is the handoff format, not a live sync.

**Why CSV, not a direct write.** The app has no server and no API; a skill cannot reach into a phone's IndexedDB. A downloadable CSV is the simplest bridge: the user can tidy it up by hand before importing, and it exercises the same import path as any other bulk entry, rather than needing a separate skill-only path.

## CSV format

The contract between the skills and the app. Both skills write it, the app reads it, and a person can edit it in any spreadsheet in between. Plain UTF-8, comma separated, one header row, standard quoting for fields containing commas.

**Items file** (from the add-to-wardrobe skill)

| Column | Required | Allowed values | If blank |
| --- | --- | --- | --- |
| name | yes | Free text | Row is rejected |
| category | yes | A category name (case-insensitive) | Row is rejected |
| seasons | no | One or more of autumn, winter, spring, summer, all-year, separated by semicolons | all-year |
| fit | no | fits-well, fits-replace, doesnt-fit, not-checked | not-checked |
| state | no | pile, on-rail, stored, archived | pile |
| brand | no | Free text | Empty |
| size | no | Free text | Empty |
| material | no | Free text | Empty |
| colour | no | Free text | Empty |
| notes | no | Free text | Empty |
| archived\_reason | no | sold, donated, other; only read when state is archived | Empty |

There is no id column; the app generates ids on import and sets the timestamps. Columns it does not recognise are ignored with a note in the preview, and column order does not matter.

**Categories file** (from the wardrobe setup skill)

| Column | Required | Allowed values | If blank |
| --- | --- | --- | --- |
| category | yes | Free text | Row is rejected |
| rail | yes | The name of a zone, such as Short, Medium or Long | Row is rejected |
| target | no | A whole number of items | No target set |

This is a second, smaller file so the skill's output can seed categories and targets in one step instead of being retyped by hand.

**Rails file** (from the wardrobe setup skill, optional)

| Column | Required | Allowed values | If blank |
| --- | --- | --- | --- |
| rail | yes | Free text, such as Short, Medium or Long | Row is rejected |
| capacity\_inches | yes | A whole number of inches | Row is rejected |

Rails are listed in the order they appear in the file, which sets their display order. Import the rails file before the categories file, so every `rail` in the categories file already exists. Rail names must match exactly, since that is how categories find their rail.

**Import behaviour**

- Import is additive: it adds new items and categories and never overwrites or deletes existing ones.
- A preview comes first, showing the counts to be added, any rows with problems and why, and possible duplicates (same name, brand and size as an existing item). Nothing is written until the user confirms.
- A category in the items file that does not exist yet is offered in the preview as either mapped to an existing category or created new, so a typo does not silently spawn a category.
- Rows with errors are skipped and listed; the rest import. The user can instead fix the file and upload it again.
- Imported items follow the normal rules: pile items use no inches, and on-rail items count against their rail.
- A rail whose name already exists is never changed silently. The preview shows the current and new capacity side by side, and the user chooses to keep the current one or use the new one.
- A category that names a rail that does not exist is flagged in the preview instead of importing, with the option to import the rails file first.

## Prioritisation

Phase 1 is everything needed for the sort happening now; nothing else is allowed in. Gap reporting is not a separate feature: "needed" and "surplus" fall out of targets and counts. Selling support stays minimal on purpose: archive in phase 1, copy details in phase 2.

| Phase | Feature | Why here | Effort |
| --- | --- | --- | --- |
| 1 (MVP) | Rails with editable capacity and inches per item | The rail capacity is the whole idea. | S |
| 1 (MVP) | Categories with default rails, and a target count per category | Answers "how many of each should go back". | M |
| 1 (MVP) | Add item with quick-add, plus state and fit | Gets the pile in. Fit and state drive every decision. | M |
| 1 (MVP) | Rails screen with live gauges and over-capacity warnings | The at-a-glance view of how full the wardrobe is. | M |
| 1 (MVP) | Sort screen: Put back, Not now, Let go | The actual activity. | M |
| 1 (MVP) | Items list with search, filters and archived toggle | Finding things, and the manual sizing history. | M |
| 1 (MVP) | JSON export and import | Protects against browser data loss. | S |
| 1 (MVP) | CSV import and export | The handoff format for the two Claude skills: they produce a CSV, the app imports it. Individual add-item still works without it. | S |
| 1 (MVP) | Installable PWA, offline, GitHub Pages deploy | The delivery model. | M |
| 2 | Replace list for fits-but-replace items | The keep-for-now middle state stays visible. | S |
| 2 | Copy details button | Removes retyping when listing an item for sale. | S |
| 2 | Needed and surplus summary as a shopping list | Makes the gaps easy to take shopping. | S |
| 3 | Season swap workflow | Not a like-for-like swap; wait until it has been lived through. | M |
| 3 | A second plan (spring and summer) | The model already allows it. | M |
| 3 | Other storage zones: shoes, shelves, drawers | Needs a count unit rather than inches. | M |
| Later | Onboarding and neutral defaults for other people, translations | Only matters once there are other users. | M |
| Later | Colour balance, outfit pairing, photos, brand and size suggestions from history | Valuable, each its own project. | L |

## Technical approach and extensibility

A small static single-page app, built once and served from GitHub Pages. The stack is a recommendation; the seams below matter more than the framework.

| Area | Approach |
| --- | --- |
| Build | Vite with TypeScript and a light UI layer such as Preact, keeping the bundle small. |
| Hosting | GitHub Pages, deployed by a GitHub Actions workflow on push to main. The Vite `base` is set to the repo path. |
| Routing | Hash-based routes (`#/rails`). GitHub Pages has no server-side fallback, so this avoids 404s on refresh. |
| Storage | IndexedDB behind a `Repository` interface, so the UI never touches the database directly. |
| Persistence | Request `navigator.storage.persist()` and remind the user to back up if the last export is over 30 days old. |
| Offline and install | Service worker precaches the app shell; web app manifest with standalone display, relative `start_url`, 192 and 512 px icons including a maskable one. |
| Updates | When a new service worker is waiting, show a "New version available, reload" banner rather than swapping silently. |
| Validation | Imports are parsed against a schema and migrated by `schemaVersion` before any write. |
| Testing | Unit tests for the capacity engine, migrations and import validation; a smoke test for add, sort, export and import. |

**Why backups matter.** Browsers can clear site data, and Safari on iOS may evict storage for sites that are not used for a while, though installed home-screen apps are treated more kindly. Install guidance and backup reminders are part of v1, not polish. iOS has no install prompt, so Settings explains "Share, then Add to Home Screen".

**The seams that keep it extensible**

- **Capacity engine as a pure function.** `computeCapacity(items, zones, categories, plan)` returns per-zone and per-category results, with no DOM or storage imports. New rules slot in without touching the UI.
- **Zones carry a unit.** Inches today; a count for shelves or drawers later.
- **Plans carry the seasons.** Autumn and winter now; spring and summer is a second plan, not a rewrite.
- **Categories and defaults are data.** Built-in categories, default rails and capacities live in a data file, so another person's setup is a different file rather than a different app.
- **Repository interface.** An alternative store or optional sync can replace IndexedDB later.
- **Versioned export.** Every shape change is a migration, so users' data survives releases.

**Repo layout (suggested):** `/src` (app), `/src/engine` (capacity logic), `/src/data` (default zones and categories), `/spec` (this spec as markdown), `/.github/workflows/deploy.yml`.

## Non-functional requirements and MVP acceptance

**Non-functional**

- **Privacy:** no analytics, no third-party scripts, no network calls after install. Data leaves the device only when the user exports it.
- **Performance:** loads in under 2 seconds on a mid-range phone on 4G, with JavaScript under 200 KB gzipped, and stays smooth at 500 items.
- **Accessibility:** WCAG 2.2 AA, touch targets of at least 44 px, rail status shown as text and numbers as well as colour, respects reduced motion and system dark mode.
- **Resilience:** an import never partially applies; a failed validation leaves existing data untouched.
- **Compatibility:** current Safari on iOS, Chrome on Android, and desktop Chrome, Safari and Firefox.

**MVP is done when**

- [ ] Each rail shows the right used and capacity inches after items are put back, moved or archived, and flags when it is over.
- [ ] Targets can be set per category, with a warning if a rail's targets add up to more than its capacity.
- [ ] Put back, Not now and Let go update the counts immediately.
- [ ] Quick-add lets a new user enter 20 items in under 10 minutes.
- [ ] Only on-rail items use inches; pile, stored and archived items do not.
- [ ] Archived items are excluded from counts but found by searching name, brand or size.
- [ ] The app loads and works in airplane mode after the first visit.
- [ ] It installs to the home screen on iOS and Android and opens standalone.
- [ ] Export, clear all data, then import restores everything exactly.
- [ ] A CSV with the expected columns imports as new items, alongside individual add-item, so a skill's output or a spreadsheet can seed the wardrobe in bulk.
- [ ] A rails file and a categories file import in that order and set up the three rails, their capacities, and every category with its target, without typing anything in Settings.
- [ ] A malformed or newer-version backup is rejected with a clear message and changes nothing.
- [ ] The GitHub Actions workflow deploys to Pages on push with no manual steps.
- [ ] Unit tests cover the capacity engine, import validation and migrations.

## Later features and open questions

**Backlog, not yet scheduled**

- Season swap workflow, once the first swap has shown what the rule should be.
- A spring and summer plan alongside autumn and winter.
- Other storage zones: shoes, shelves, drawers and containers, with a count unit.
- Brand and size suggestions drawn from archived history, such as "this brand's size 10 fit well last time".
- Colour balance and outfit pairing.
- Photos stored on the device, with a size warning in the backup.
- Wear tracking and "not worn in a year" prompts.
- For other people: onboarding, neutral default categories and capacities, translations.
- A shopping-companion Claude skill: takes the replace list and category gaps, then helps search for and evaluate candidates against the user's own sizing history from archived items. Deliberately after the first two skills are in use.

**Open questions (resolved)**

- What is the app called? It affects the repo name, Pages URL and manifest.
- Resolved: targets are descriptive, not a forced sum. They can land above, below or at a rail's capacity — whatever feels sensible for that category — and the rail itself still warns if its on-rail items run over capacity.
- Resolved: kept as two separate categories, since bulky jumpers are more likely to be seasonal than light ones. More generally, categories are user-configurable — the eleven that ship are a starting set the user expects to adjust while actually sorting.
- Resolved: one item, since it hangs on one hanger.
- Resolved: stay hidden. The sorting view only ever shows autumn, winter and all-year items while this plan is active.
- Everyone has a physical capacity limit, but "one item per inch" is this user's own strict rule on top of it, not a universal one. Other people are more likely to think in capsule-wardrobe terms (small, medium, large) than in measured inches. Worth learning from others: whether they'd even express their limit as a number at all, and what unit or looser shape they'd reach for instead.
