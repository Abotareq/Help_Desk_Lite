# HelpDesk Lite

Internal support ticketing workspace — a single, lightweight place for employees to submit
requests, for support staff to own and work them, and for managers to see what's open.

One repository, two packages, wired together as npm workspaces:

```
helpdesk-lite/
├── backend/     Node + Express + MongoDB + TypeScript API
├── frontend/    React + Vite web client
└── package.json workspace root
```

## Getting started

One install at the root covers both packages:

```bash
npm install
```

The API needs its own environment file and a bootstrap manager account:

```bash
cp backend/.env.example backend/.env
```

```bash
npm run seed
```

Then run whichever side you're working on:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

## Scripts

All of these run from the repository root.

| Script | What it does |
| --- | --- |
| `npm run dev:api` | Start the API with hot reload |
| `npm run dev:web` | Start the Vite dev server |
| `npm run build` | Build both packages |
| `npm run build:api` / `build:web` | Build one of them |
| `npm test` | Run every package's tests |
| `npm run test:coverage` | API tests with coverage thresholds enforced |
| `npm run lint` | Lint every package that defines a linter |
| `npm run seed` | Create the bootstrap manager account |

To run a script inside one package directly:

```bash
npm run <script> --workspace backend
```

## backend/

The API. Node + Express + MongoDB (Mongoose) + TypeScript, with Zod for validation and Jest
for tests. Layered so `domain/` never imports Mongoose and the repository interfaces are the
seam unit tests substitute fakes at.

v1 is complete: structured submission, single ownership with claim and reassignment, a
five-state workflow with a reopen path, full per-request history, three roles, the manager
queue and dashboard counts, and account administration.

See [backend/README.md](backend/README.md) for the endpoint table, the workflow rules and
what is deliberately deferred.

## frontend/

The web client. React 19 + Vite + TypeScript, strict mode on. Currently the starter scaffold
— the interfaces described in the PRD (submission form, requester's request list, handler
queue, manager dashboard) are not built yet.

`npm run build --workspace frontend` typechecks before it bundles, so a type error fails the
build rather than shipping. `npm run typecheck --workspace frontend` runs the check alone.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and every push to `main`: `npm ci`,
`npm run build` (both packages), then the API suite with coverage thresholds enforced. A
drop below the floor fails the build.
