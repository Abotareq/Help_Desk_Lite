# HelpDesk Lite API

Internal support ticketing API for HelpDesk Lite v1 — a lightweight place for employees to
submit requests, for support staff to own and work them, and for managers to see what's open.

Node + Express + MongoDB (Mongoose) + TypeScript, with Zod for input validation and Jest for tests.

## Status

Built progressively. See the branch/PR history for each increment.

- [x] Project scaffolding, config, error handling, test harness
- [x] Users, roles, authentication
- [ ] Request intake
- [ ] Assignment and ownership
- [ ] Status lifecycle and history
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

Authenticated calls send `Authorization: Bearer <token>`.

## Roles

| Role | Can |
| --- | --- |
| `EMPLOYEE` | Submit requests, track their own |
| `AGENT` | Support/ops staff — claim, work and resolve requests |
| `MANAGER` | Everything an agent can, plus see all requests, assign work, manage accounts |

There is no public registration in v1: managers create accounts and set roles.

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
