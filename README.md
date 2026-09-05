# HelpDesk Lite API

Internal support ticketing API for HelpDesk Lite v1 — a lightweight place for employees to
submit requests, for support staff to own and work them, and for managers to see what's open.

Node + Express + MongoDB (Mongoose) + TypeScript, with Zod for input validation and Jest for tests.

## Status

Built progressively. See the branch/PR history for each increment.

- [x] Project scaffolding, config, error handling, test harness
- [x] Users, roles, authentication
- [x] Request intake
- [x] Assignment and ownership
- [x] Status lifecycle and history
- [ ] Manager visibility

## Getting started

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI and JWT_SECRET
npm run dev
```

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
| POST | `/api/auth/login` | anyone | Exchange email + password for a JWT |
| GET | `/api/users/me` | any signed-in user | The caller's own profile |
| POST | `/api/users` | MANAGER | Create a user and set their role |
| GET | `/api/users` | MANAGER, AGENT | List users, filterable by `role` and `isActive` |
| POST | `/api/requests` | any signed-in user | Submit a support request |
| GET | `/api/requests/:id` | requester, assignee, manager | Read one request |
| GET | `/api/requests/mine` | AGENT, MANAGER | The caller's own queue, highest priority first |
| POST | `/api/requests/:id/claim` | AGENT, MANAGER | Take an unclaimed request |
| PATCH | `/api/requests/:id/assign` | MANAGER | Assign, reassign, or return to the queue (`assigneeId: null`) |
| PATCH | `/api/requests/:id/status` | depends on the move | Move the request through the workflow |
| GET | `/api/requests/:id/history` | requester, assignee, manager | Full audit trail, oldest first |

Authenticated calls send `Authorization: Bearer <token>`.

## Roles

| Role | Can |
| --- | --- |
| `EMPLOYEE` | Submit requests, track their own |
| `AGENT` | Support/ops staff — claim, work and resolve requests |
| `MANAGER` | Everything an agent can, plus see all requests, assign work, manage accounts |

There is no public registration in v1: managers create accounts and set roles.

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

## Testing

- **Unit** (`tests/unit/`) — services against hand-rolled fakes of the repository interfaces.
  No database, no Express.
- **Integration** (`tests/integration/`) — `mongodb-memory-server` plus supertest against the real
  app, so actual Mongoose queries and route wiring are exercised.
