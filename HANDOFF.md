# HelpDesk Lite — session handoff

Last updated: 2026-09-10 · `main` at `ad28edd` · 31 PRs merged · no open PRs

---

## What this is

An internal support ticketing system built from a PRD and an architecture doc. One repo,
two npm workspaces:

```
helpdesk-lite/
├── backend/     Node + Express 4 + MongoDB (Mongoose) + TypeScript
├── frontend/    React 19 + Vite + TypeScript + Tailwind
└── package.json workspace root
```

Repo: <https://github.com/Abotareq/Help_Desk_Lite> · Jira: project **KAN** on
`tareq12.atlassian.net` (MCP already connected, read+write).

**374 backend tests, 184 frontend.** Coverage floor enforced in CI (95% statements,
80% branches; `src/domain/workflow/` pinned at 100%).

---

## Running it

MongoDB must be listening on `127.0.0.1:27017` — on this machine it runs as a Windows
service. Then, from the repo root:

```bash
npm install
```
```bash
cp backend/.env.example backend/.env
```
```bash
npm run seed
```
```bash
npm run dev:api
```
```bash
npm run dev:web
```

`.env.example` works verbatim. Seeded manager: `manager@example.com` / `ChangeMe123!`.
Everyone else is created by a manager from **People → Add person** — there is no self sign-up.

**Local test accounts** (database `helpdesk_lite`): `agent@example.com` and
`employee@example.com`, both `ChangeMe123!`.

### Gotcha

`npm run dev:*` spawns `ts-node-dev` and `vite` children that **survive being stopped from
the agent harness**. They accumulate, hold file locks (this broke an `npm ci` once), and
may be behind an intermittent backend test failure. Kill them by command line, never
blanket-kill node:

```bash
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*HelpDeskLite*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
```

---

## Decisions that are load-bearing

Change these only deliberately — each has tests that will fail if you do it by accident.

| Decision | Where | Why |
| --- | --- | --- |
| **Agents own the queue; managers do not** | `backend/src/domain/enums/UserRole.ts` → `HANDLER_ROLES = [AGENT]` | Managers direct work rather than doing it. One constant drives claiming, assignment targets, the queue endpoint, the assignee dropdown, the sidebar and the route guard. |
| **Workflow lives in one table** | `backend/src/domain/workflow/transitions.ts` | Ambiguous states are the failure the PRD exists to fix. Permission is a *relation* (requester / assignee / manager), not a role. |
| **The frontend mirrors that table** | `frontend/src/lib/workflow.ts` | So the UI never *offers* a move the API would refuse. `workflow.test.ts` imports the backend table across the workspace and fails if they drift. |
| **Invisible records 404, never 403** | `RequestService.getRequestById` | A 403 confirms the record exists. |
| **Express 4, pinned** | `backend/tests/unit/dependencies.test.ts` | npm silently rewrote it to `^5` once and nothing noticed. Asserts the declared range *and* the runtime version. |
| **Scope narrows, never refuses** | `RequestService.toRepositoryQuery` | An employee filtering by someone else's id gets an empty list, not a 403. |
| **No public registration** | `POST /api/users` is manager-only | Internal-only tool; the first manager comes from `npm run seed`. |
| **Comments never ride on a request payload** | `MongoRequestRepository.addComment` / `listComments`; `RequestService.listComments` | A request is returned by half a dozen routes, including bulk lists an employee can call. If comments were a field of `SupportRequest`, every one of those would have to remember to redact internal notes, and the first to forget would leak them all at once. One road out, one place that filters. Two integration tests assert the absence on the detail *and* list endpoints. |
| **Internal notes are for handlers, not for agents** | `RequestService.canReadInternal` | Assignee and managers — the same pair the transition table calls a handler. Deliberately not "anyone with the AGENT role": an agent who raised a ticket about their own laptop is its *requester*, and the notes written about it are not for them. |
| **A hold's reason is a comment, not a history note** | `StatusActions.asStatusChange`; `comment` on `UpdateStatusSchema` | A note is an annotation nobody can answer. The whole point of saying what you are waiting for is that the requester replies. The comment is checked *before* the status moves, so a refused message never leaves a request moved with the explanation missing. |
| **Recategorising is a handler's correction** | `RequestService.changeCategory` | Assignee and managers, not the requester who chose it — letting them overrule the correction restarts the argument. An unclaimed agent gets 403, not 404: the request is visibly sitting in their queue, so a 404 would be a lie they could disprove on the next screen. |
| **Themes are one set of token names with two sets of values** | `frontend/src/index.css` | Every component reads `--color-surface` / `--color-ink` and never asks which theme is on. A `dark:` variant across several hundred class lists is the same result with several hundred more places to forget one. Anything hard-coded to a Tailwind palette colour cannot follow the theme — that is why Alert, Button's danger hover and the sidebar scrim had to be tokenised. |
| **Brand fills carry their own foreground** | `--color-on-brand` | The brand is dark in one theme and light in the other, so a hard-coded white label measures 6.29:1 in one and 3.14:1 in the other — on the primary button. |
| **English is the source of truth for message keys** | `frontend/src/i18n/en.ts`, with `ar.ts` typed as `Catalogue` | A missing translation is a compile error, not a key rendered at a user. Enum values reach keys through typed helpers, so adding a status without translating it also fails to build. |
| **Whole sentences are catalogue entries, never concatenated** | `Timeline.describe` | Arabic puts the verb first, so an actor-name-plus-fragment sentence has no correct Arabic equivalent. This is why KAN-66 stores categories as structured fields rather than a pre-built phrase. |
| **User text declares its own direction** | `dir="auto"` on comment bodies, notes, descriptions and titles | Ours is translated and follows the page; theirs is not. Without it, an English comment inside an Arabic page renders its trailing punctuation at the front. |

Resolved PRD open questions: states `NEW → IN_PROGRESS → WAITING → RESOLVED → CLOSED` with
reopen; single owner, claim-based; fixed category list; three roles; managers get both a
filterable list and aggregate counts.

---

## How this project works

`WORKFLOW.md` covers this in full, including the traps. In short — every change follows
the same loop, and it has repeatedly paid for itself:

1. Branch → build → **test** → PR with a body explaining the *why*, not just the what
2. CI must be green before merge (`npm ci` → `npm run build` → `npm run test:coverage`)
3. **Mutation-test anything that matters** — deliberately break the behaviour and confirm
   the suite fails. A test that never fails is theatre. Two traps, both hit for real:
   a "failure" that is actually a compile error (`0 tests total` means the suite did not
   run, not that it caught something), and a test that *survives* a mutation because some
   **other** rule was refusing the call. KAN-52's pre-move comment check looked guarded
   until the mutation showed the test was passing on the transition rule instead; it now
   uses a case where the move is legal and only the comment is not.
4. **Drive the real UI in a browser**, not just the test suite
5. Comment on the Jira ticket with what shipped, then transition it

Five findings came *only* from step 4, and none were visible from reading the code:
a raw ObjectId reaching a requester's timeline; an employee unable to see who was handling
their request; manager screens reachable by typing the URL while the sidebar hid the link;
ESLint silently linting nothing after the `.jsx` → `.tsx` rename; and React Fast Refresh
breaking because a non-component helper was exported from a component file — that one was
in the dev server's HMR log, which no test reads.

---

## Where things stand

### Done
Both epics of the API and the whole web client. Sign-in, employee views, agent queue,
manager dashboard / all-requests / people, account administration, sign-in throttling.
40+ Jira issues closed.

Plus **KAN-52, comments on a request** (PR #24): a thread on every request, internal notes
for handlers, and the detail page's History card replaced by **Activity** — status changes,
assignment changes and comments merged into one chronological account. Putting a request on
hold now asks a question the requester can answer in place, which is the email round trip
this project exists to remove.

And three more, requested directly rather than taken off the backlog:

- **KAN-66, a handler can correct a request's category** (PR #29). Recorded in history like
  every other change, carrying both categories as structured fields.
- **KAN-67, a dark theme** (PR #30). Light / Dark / Auto, applied before first paint.
- **KAN-68, English and Arabic** (PR #31). Full RTL, with `Intl` for plurals, relative time
  and numbers. **API error messages are still English** — that gap is KAN-69, not an oversight.

### Open on the board (19)

**Deferred by decision** — not oversights: KAN-11/23/49 (knowledge base), KAN-20/45
(confidentiality rules), KAN-22/47/48 (permissions finer than three roles).

**v2 backlog**, roughly in the order I would take them:

| Ticket | Why it matters |
| --- | --- |
| **KAN-53** Notifications | Now the biggest gap, and comments made it bigger: people can talk on a request but nobody is told when they do. "No updates without chasing" is a stated problem in the PRD. |
| **KAN-55** Docker + compose | The deploy target is now Vercel, so this is for local parity and any future self-hosting, not for shipping. |
| **KAN-56** OpenAPI from the Zod schemas | Would let the hand-written `frontend/src/types/domain.ts` be generated instead. |
| **KAN-57** Logging, `/ready`, request ids | Rate limiting is done; the operability half is not. |
| **KAN-58** Metrics | The PRD names four success metrics and none are measurable. |
| **KAN-69** Translatable API errors | An Arabic user reads an Arabic interface right up until something is refused, and then gets English. The direct follow-up to KAN-68. |
| KAN-54 Attachments | "A picture of the error" currently has to arrive by email — the one part of the email round trip comments did not close. |

**KAN-9 and KAN-10 look wrong on the board.** Both epics are open only because their
deferred children are. If you want the board to read "v1 delivered", move KAN-20/45 and
KAN-22/47/48 under the v2 epics (KAN-50/51) and close the two v1 epics. I did not do this
unprompted — reshaping someone's epic structure is their call.

---

## Not done, and worth knowing

- **Deployed to Vercel** (PR #27) — API as a serverless function, client as static output
  on the same origin. No connection string is committed: environment variables live in the
  dashboard, and Atlas Network Access must permit Vercel's dynamic egress IPs.
  **Git auto-deploy is connected, and confirmed working** — merging #31 produced a production
  deployment 44 seconds later with no manual step. It was *not* connected for #28 to #30,
  which is why the live site sat three PRs behind until someone thought to check.
  **Deployment Protection is still on**, so the URL asks for Vercel SSO and only the account
  owner can open it. Settings → Deployment Protection → Vercel Authentication → Disabled.
- **`main` is unprotected.** CI reports failures but will not block a merge; all 31 PRs
  were merged directly. Settings → Branches → require `Typecheck and test`.
- **No sprint exists.** KAN-50–58 sit in the backlog; the Atlassian MCP connector has no
  sprint-creation endpoint, so that is a board action.
- **No end-to-end browser automation**, no React error boundary, no accessibility audit.
- **Branches are deleted after merge.** The remote holds `main` and nothing else; the 25
  that had piled up were pruned once every one was confirmed merged. Keep it that way —
  `gh api -X DELETE repos/Abotareq/Help_Desk_Lite/git/refs/heads/<branch>` if `git push
  --delete` is refused by the harness.
- `S:\ICAREER\HelpDeskLiteIcareer\` is the superseded original frontend folder; safe to delete.

---

## Immediately outstanding

Nothing in flight. `main` is green, the tree is clean, and there are no open PRs.

Start with whatever you pick from the v2 backlog above. KAN-53 is top of it.

The local test database `helpdesk_lite` holds four requests and four users. **HD-000004 is
the one to demo**: raised by `employee@example.com`, claimed by `agent@example.com`, parked
in `WAITING` with a four-message thread — the agent asks for an asset tag, leaves an internal
note, puts it on hold, and the requester answers. Sign in as the agent and then as the
employee to watch the internal note disappear — 12 timeline entries against 11, having
gained a recategorisation while KAN-66 was being driven. Its category is now FACILITIES. The
other three requests are untouched from earlier sessions. Point `MONGODB_URI` at a new name
for a clean slate.

Switch the sidebar's language toggle to العربية on that same request to see RTL with real
content in it: the layout mirrors while the English comment bodies keep their own direction.
