# HelpDesk Lite — session handoff

Last updated: 2026-09-07 · `main` at `3a05856` · 22 PRs merged · no open PRs

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

**298 backend tests, 110 frontend.** Coverage floor enforced in CI (95% statements,
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

Resolved PRD open questions: states `NEW → IN_PROGRESS → WAITING → RESOLVED → CLOSED` with
reopen; single owner, claim-based; fixed category list; three roles; managers get both a
filterable list and aggregate counts.

---

## How this project works

Every change follows the same loop, and it has repeatedly paid for itself:

1. Branch → build → **test** → PR with a body explaining the *why*, not just the what
2. CI must be green before merge (`npm ci` → `npm run build` → `npm run test:coverage`)
3. **Mutation-test anything that matters** — deliberately break the behaviour and confirm
   the suite fails. A test that never fails is theatre. Watch for a "failure" that is
   actually a compile error: `0 tests total` means the suite did not run, not that it caught
   something.
4. **Drive the real UI in a browser**, not just the test suite
5. Comment on the Jira ticket with what shipped, then transition it

Four defects were found *only* by step 4, and none were visible from reading the code:
a raw ObjectId reaching a requester's timeline; an employee unable to see who was handling
their request; manager screens reachable by typing the URL while the sidebar hid the link;
ESLint silently linting nothing after the `.jsx` → `.tsx` rename.

---

## Where things stand

### Done
Both epics of the API and the whole web client. Sign-in, employee views, agent queue,
manager dashboard / all-requests / people, account administration, sign-in throttling.
40+ Jira issues closed.

### Open on the board (19)

**Deferred by decision** — not oversights: KAN-11/23/49 (knowledge base), KAN-20/45
(confidentiality rules), KAN-22/47/48 (permissions finer than three roles).

**v2 backlog**, roughly in the order I would take them:

| Ticket | Why it matters |
| --- | --- |
| **KAN-52** Comments on a request | The biggest functional gap. A handler needing one more detail still has to email — the exact behaviour this project replaces. `WAITING` says a request is blocked but not on what. |
| **KAN-53** Notifications | Nobody learns their request moved without checking. "No updates without chasing" is a stated problem in the PRD. |
| **KAN-55** Docker + compose | Only worth doing once a deploy target is chosen. |
| **KAN-56** OpenAPI from the Zod schemas | Would let the hand-written `frontend/src/types/domain.ts` be generated instead. |
| **KAN-57** Logging, `/ready`, request ids | Rate limiting is done; the operability half is not. |
| **KAN-58** Metrics | The PRD names four success metrics and none are measurable. |
| KAN-54 Attachments | "A picture of the error" currently has to arrive by email. |

**KAN-9 and KAN-10 look wrong on the board.** Both epics are open only because their
deferred children are. If you want the board to read "v1 delivered", move KAN-20/45 and
KAN-22/47/48 under the v2 epics (KAN-50/51) and close the two v1 epics. I did not do this
unprompted — reshaping someone's epic structure is their call.

---

## Not done, and worth knowing

- **Never deployed.** Runs on this machine and on GitHub's CI runners, nowhere else. This
  is the only thing between the current state and a support team using it.
- **`main` is unprotected.** CI reports failures but will not block a merge; all 22 PRs
  were merged directly. Settings → Branches → require `Typecheck and test`.
- **No sprint exists.** KAN-50–58 sit in the backlog; the Atlassian MCP connector has no
  sprint-creation endpoint, so that is a board action.
- **No end-to-end browser automation**, no React error boundary, no accessibility audit.
- **23 stale branches on the remote** — nothing was deleted after merge.
- `S:\ICAREER\HelpDeskLiteIcareer\` is the superseded original frontend folder; safe to delete.

---

## Immediately outstanding

Nothing in flight. `main` is green, the tree is clean, and there are no open PRs.

Start with whatever you pick from the v2 backlog above — or, if the goal is to get this in
front of real users, pick a deploy target first, because that is the only thing standing
between the current state and a support team using it.

The local test database `helpdesk_lite` holds a manager-raised request and an agent-claimed
one, which is convenient for demoing. Point `MONGODB_URI` at a new name for a clean slate.
