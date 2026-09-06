# HelpDesk Lite API

Internal support ticketing API for HelpDesk Lite v1 — a lightweight place for employees to
submit requests, for support staff to own and work them, and for managers to see what's open.

Node + Express + MongoDB (Mongoose) + TypeScript, with Zod for input validation and Jest for tests.

## Status

v1 is complete. Built progressively — see the branch/PR history for each increment.

- [x] Project scaffolding, config, error handling, test harness
- [x] Users, roles, authentication
- [x] Request intake
- [x] Assignment and ownership
- [x] Status lifecycle and history
- [x] Manager visibility

## Getting started

This package is part of an npm workspace — install once from the repository root, not here.

```bash
npm install            # from the repository root
cp .env.example .env   # then fill in MONGODB_URI and JWT_SECRET
npm run dev --workspace backend
```

Every script below can also be run from the root with `--workspace backend`.

`GET /health` should return `{ "status": "ok" }`.

Then create the first manager account — every other user is created by a manager,
so this is the only way in:

```bash
npm run seed
```

## Endpoints

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/health` | anyone | Liveness check |
| POST | `/api/auth/login` | anyone | Exchange email + password for a JWT (throttled) |
| GET | `/api/users/me` | any signed-in user | The caller's own profile |
| POST | `/api/users` | MANAGER | Create a user and set their role |
| GET | `/api/users` | MANAGER, AGENT | List users, filterable by `role` and `isActive` |
| GET | `/api/users/:id` | any signed-in user | One colleague, so a requester can see who is handling their request |
| PATCH | `/api/users/:id` | MANAGER | Rename, change role, deactivate or reactivate |
| POST | `/api/users/:id/password` | MANAGER | Reset someone's password |
| POST | `/api/requests` | any signed-in user | Submit a support request |
| GET | `/api/requests/:id` | requester, assignee, manager | Read one request |
| GET | `/api/requests/mine` | AGENT, MANAGER | The caller's own queue, highest priority first |
| POST | `/api/requests/:id/claim` | AGENT, MANAGER | Take an unclaimed request |
| PATCH | `/api/requests/:id/assign` | MANAGER | Assign, reassign, or return to the queue (`assigneeId: null`) |
| PATCH | `/api/requests/:id/status` | depends on the move | Move the request through the workflow |
| GET | `/api/requests/:id/history` | requester, assignee, manager | Full audit trail, oldest first |
| GET | `/api/requests` | any signed-in user, scoped | Filterable, paginated list |
| GET | `/api/requests/stats` | any signed-in user, scoped | Dashboard counts |

Authenticated calls send `Authorization: Bearer <token>`.

## Sign-in throttling

`POST /api/auth/login` allows 10 **failed** attempts per IP per 15 minutes by default
(`LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MS`), then returns 429 in the usual error
envelope.

Keyed by IP rather than by email: keying on the address would let anyone lock a colleague
out of their own account by failing that login enough times. Successful sign-ins are not
counted, so a shared office address does not throttle itself.

Set `TRUST_PROXY_HOPS` if you deploy behind a reverse proxy — otherwise every request looks
like it comes from the proxy and the limit applies to all traffic at once. It defaults to 0
because trusting `X-Forwarded-For` when nothing sets it would let a caller spoof past the
limit.

The store is in-memory, so the limit is per process. Running more than one instance needs a
shared store.

## Roles

| Role | Can |
| --- | --- |
| `EMPLOYEE` | Submit requests, track their own |
| `AGENT` | Support/ops staff — claim, work and resolve requests |
| `MANAGER` | Everything an agent can, plus see all requests, assign work, manage accounts |

There is no public registration in v1: managers create accounts and set roles.

## Account administration

A manager can rename an account, move someone between roles, deactivate a leaver and
reactivate them, and reset a password — there is no self-service recovery in v1. Email is
not editable: it is the account's identity and what the audit trail reads against.

Two guards exist so the system cannot be locked out of itself. A manager cannot deactivate
their own account or drop their own manager role, and the last *active* manager can be
neither deactivated nor demoted. Deactivated managers do not count as cover.

Deactivating someone — or demoting a handler to `EMPLOYEE` — does not delete their requests
or touch the history. It does return the open requests that change leaves without a usable
owner:

```json
{
  "user": { "id": "652f...", "isActive": false },
  "orphanedRequests": [{ "id": "6530...", "reference": "HD-000042", "status": "IN_PROGRESS" }]
}
```

It warns rather than blocking: the change goes through, and the manager finds out at that
moment rather than when a requester chases an untouched ticket weeks later.

## Requests

A submission carries `title`, `description`, a `category` picked from a fixed list
(`IT`, `HR`, `FACILITIES`, `OTHER`) and a `priority` (`LOW`, `MEDIUM`, `HIGH`, defaulting
to `MEDIUM`). The requester comes from the token, never the body.

Each request gets a sequential human-readable reference (`HD-000042`) alongside its id,
opens as `NEW` and unassigned, and starts a history that every later change appends to.

## Workflow

```
NEW ──▶ IN_PROGRESS ⇄ WAITING
 │        │     ▲         │
 │        ▼     └─ reopen ┘
 │     RESOLVED ──▶ CLOSED
 └──────────────────▶
```

Every legal move lives in one table at `src/domain/workflow/transitions.ts`; anything not
in it is refused. The states were the PRD's biggest open question, so keeping them
declarative means the workflow can be read against the answer instead of traced through a
service.

Who may make a move is expressed as a *relation* to the request, not a role:

| Move | Who |
| --- | --- |
| `NEW` -> `IN_PROGRESS` | assignee, manager |
| `NEW` -> `CLOSED` | requester (withdrawing), manager |
| `IN_PROGRESS` -> `WAITING` / `RESOLVED` | assignee, manager |
| `WAITING` -> `IN_PROGRESS` | requester (answering), assignee, manager |
| `WAITING` -> `RESOLVED` | assignee, manager |
| `RESOLVED` -> `IN_PROGRESS` (reopen) | requester, assignee, manager |
| `RESOLVED` -> `CLOSED` | requester, assignee, manager |

`CLOSED` is terminal. Reopening clears `resolvedAt`, so it always means "resolved this time
round" rather than "was resolved once", and keeps the existing owner rather than dropping
the request back on the queue.

## Ownership

A request has one owner at a time. It starts unassigned; a handler claims it off the queue,
and a manager can assign or reassign it, or hand it back with `assigneeId: null`. Claiming
is not reassignment — taking work off whoever already owns it is a manager action, so a
claim only succeeds on an unclaimed request.

Picking up a `NEW` request also moves it to `IN_PROGRESS`. Something owned but still sitting
in `NEW` is exactly the ambiguous state the PRD sets out to remove.

Visibility: employees see only what they submitted, agents also see the unclaimed queue and
their own assigned work, managers see everything. A request the caller cannot see returns
404 rather than 403, so the response does not confirm it exists.

## The manager view

`GET /api/requests` filters on `status`, `category`, `priority`, `assignee` and `requester`,
pages with `page` and `limit`, and sorts with `sortBy` (`createdAt`, `updatedAt`, `priority`,
`status`) and `sortDir`. Multi-value filters take either form:

```
/api/requests?status=NEW,WAITING&priority=HIGH&sortBy=priority
/api/requests?status=NEW&status=WAITING
```

`assignee=unassigned` gives the unclaimed backlog.

`GET /api/requests/stats` answers the aggregate question with the same filters:

```json
{
  "total": 42,
  "open": 17,
  "unassigned": 5,
  "byStatus": { "NEW": 5, "IN_PROGRESS": 9, "WAITING": 3, "RESOLVED": 20, "CLOSED": 5 },
  "byAssignee": [{ "assigneeId": "652f...", "count": 9 }, { "assigneeId": null, "count": 5 }]
}
```

Every status appears in `byStatus`, zeroes included — dashboard columns that appear and
disappear as work moves are worse than useless.

Both endpoints are open to every role. Scope is applied on top of the filters rather than
instead of them, so no combination of query parameters lets a caller see more than their
role allows: an employee filtering by someone else's id gets an empty list, not a 403.

## Deferred to v2

Out of scope for v1, by decision rather than omission: a self-service knowledge base,
notifications of any kind, SLA tracking and escalation, multi-team routing, per-category
confidentiality rules, and permissions finer than the three roles.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm test` | Unit + integration tests |
| `npm run test:unit` | Unit tests only (no database) |
| `npm run test:integration` | Integration tests (in-memory MongoDB) |
| `npm run typecheck` | Type check without emitting |

## Architecture

```
src/
├── config/           env loading, Mongoose connection
├── domain/           pure TypeScript — entities, enums, repository interfaces
├── application/      services (business logic) and Zod DTO schemas
├── infrastructure/   Mongoose models, repository implementations, middlewares
├── api/              controllers and routes (routes/index.ts is the composition root)
├── shared/           AppError, asyncHandler
├── app.ts            builds the Express app (no listen — mountable by supertest)
└── server.ts         connects the database and listens
```

`domain/` never imports Mongoose. `infrastructure/repositories/` is the only place that knows
Mongo exists — services are written against the repository interfaces, which is also the seam
unit tests substitute fakes at.

## Pinned dependencies

**Express 4, deliberately.** npm silently rewrote this to `^5` during an unrelated install
once, and nothing caught it: the lockfile changed, the suite still passed, and a local
verification ran against a different major than the one committed. Express 5 changes error
handling and routing behaviour, so moving to it is a migration to do on purpose.

`tests/unit/dependencies.test.ts` asserts both the declared range and the version actually
resolved at runtime. If you upgrade intentionally, change that test in the same commit —
the friction is the point.

## Testing

- **Unit** (`tests/unit/`) — services against hand-rolled fakes of the repository interfaces.
  No database, no Express.
- **Integration** (`tests/integration/`) — `mongodb-memory-server` plus supertest against the real
  app, so actual Mongoose queries and route wiring are exercised.
