# HelpDesk Lite — how this project is built

Empty repo → 31 merged PRs, `main` at `ad28edd`, 374 backend + 184 frontend tests green.

`HANDOFF.md` is the *state* — what exists and which decisions are load-bearing.
This is the *method* — how each change gets made, and the mistakes that are worth
not repeating. Read both before touching anything.

---

## The loop, every time

1. **Branch off `main`.** One increment per branch, one PR per increment.
2. **Build, and write the tests with it** — not after.
3. **Mutation-test what matters.** Deliberately break the behaviour, confirm the
   suite goes red, restore. A test that never fails is theatre.
4. **Drive the real UI in a browser** for anything a person will touch.
5. **PR with a body explaining the *why*.** CI green before merge — `npm ci` →
   `npm run build` → `npm run test:coverage`.
6. **Comment on the Jira ticket with what shipped, then transition it.**
7. Delete the branch. The remote holds `main` and nothing else.

Steps 3 and 4 are the two that earn their keep, and both are the ones a hurried
session skips first.

---

## Step 3 has two traps. Both were hit for real.

**A "failure" that is actually a compile error.** `0 tests total` means the suite
never ran — that is not the test catching your mutation, it is tsc refusing the
file. Read the count, not the exit code.

Corollaries learned the hard way:
- **Commit before mutating.** `git checkout --` to restore wiped an uncommitted
  refactor once.
- `if (false && …)` won't compile — tsc rejects unreachable code. Use
  `Boolean(process.env.__NEVER_SET__)` when you need a mutation that type-checks.

**A green test run is not a compiling build.** `vitest` does not typecheck. A test file
that passed still broke `npm run build`, because `as const` literal types defeated a type
guard the test relied on. Run the build, not just the suite.

**A mutation that survives because a *different* rule refused the call.** This is
indistinguishable from a working test if you only watch the colour. KAN-52's
pre-move comment check looked guarded until the mutation showed the test was
passing on the *transition* rule instead. Pick a case where the move is legal and
only the thing under test can fail.

---

## Measuring the browser, not reading it

Two habits that cost real time this session, both worth keeping:

**Do not judge from a scaled screenshot.** Twice I read a toggle as showing the wrong
selection and started debugging; both times `aria-checked` said it was correct. RTL flips the
visual order, and downscaled images lose the highlight. Assert the DOM.

**Transitions do not advance while the browser pane is hidden.** No animation frames fire, so
a `transition-colors` property started by a theme flip stays pinned at its old value forever —
`setTimeout` does not help, because it is frames and not time. Any measurement of a
transitioned property after a live theme change is a lie. Reload with the theme already set
instead. This one cost about six steps of chasing a phantom through the code, the dev server
and the production build before the cause turned out to be the measurement.

**And the dev server goes stale.** Its Tailwind output and HMR module graph both got into
states where the page disagreed with the source. When something makes no sense, check against
`npm run build` output before believing it.

## What driving the browser found that no test did

Nine defects, none visible from reading the code:

1. A raw ObjectId (`Assigned to 6a9ca36f…`) reaching a requester's timeline.
2. An employee unable to see who was handling their request — a PRD requirement.
3. Manager screens reachable by typing `/dashboard`; the sidebar only hid the link.
4. ESLint silently linting **nothing** after the `.jsx` → `.tsx` rename.
5. React Fast Refresh broken by a non-component export — visible only in the dev
   server's HMR log, which no test reads.
6. A sidebar that reported itself open while sitting off-screen at
   `marginLeft: -224px`. Measuring the DOM caught what the class list did not.
7. White on the dark theme's brand at 3.14:1 — below AA, on the primary button. The brand
   fill inverts between themes; a hard-coded white label cannot be right in both.
8. The request list rendering `FACILITIES` where the detail page rendered `Facilities`.
   Invisible to every test, since none assert on casing.
9. An English comment inside an Arabic page rendering its trailing punctuation at the front,
   because it inherited the page's RTL direction instead of declaring its own.

---

## Order of work

| PRs | What |
| --- | --- |
| 1–6 | Backend v1: scaffolding, auth, intake, assignment, lifecycle, manager visibility |
| 7–8 | Test gaps: seed script, JWT expiry, reference collisions; config + middleware error paths |
| 9–11 | CI workflow, coverage floor, actions bumped to v5 |
| 12 | KAN-59 user administration |
| 13–14 | Monorepo (npm workspaces), frontend JS → TS |
| 15–18 | Web client: shell/auth, employee views, agent queue, manager views |
| 19 | Sign-in throttling |
| 20 | Password reset + component regression net (35 → 109 tests) |
| 21 | Express 4 pinned |
| 22 | Agents own the queue; sidebar closes; responsive fixes |
| 23 | HANDOFF.md |
| 24 | KAN-52 comments, internal notes, merged Activity timeline |
| 25–26 | Handoff corrected against actual state; 25 merged branches pruned |
| 27 | Vercel: serverless entry point, connection reuse, routing |
| 28 | WORKFLOW.md |
| 29 | KAN-66 a handler can correct a request's category |
| 30 | KAN-67 dark theme, as a token swap |
| 31 | KAN-68 English and Arabic, with RTL |

---

## Corrections that had to be made

Each of these was reported as done before it was true. They are here because the
pattern repeats, not because the individual bugs matter.

- **Claimed KAN-64 complete when password reset was never wired.** The hook and the
  API function existed; no UI control called them. Ticket reopened saying exactly that.
- **Verified "main works" against Express 5** while `main` declared 4 — npm had
  silently rewritten the range and the local check ran on the wrong tree. Now guarded
  by `dependencies.test.ts`, which asserts the declared range *and* the runtime version.
- **Making MANAGER a handler was an undocumented decision**, and wrong: managers
  direct work, agents do it. One constant, `HANDLER_ROLES`, now drives all six places.
- **Three handoff counts were wrong at once** (commit, PR count, test totals) because
  they were written from memory. Count from the repo, then write.
- **PR #27's first connection cache** returned whatever it connected to first
  regardless of the URI, and never checked the socket was open. The *existing* suite
  caught it, not the new tests written alongside the feature.
- **A Jira key was invented rather than looked up.** A commit referenced KAN-60 on the
  assumption it was the category ticket; KAN-60 is a Done epic called "Web Client", and no
  ticket existed at all. Caught only because the loop says to check before commenting. Look
  the key up, every time.
- **The live site sat three PRs behind for two days.** Vercel's git integration was never
  connected, the setup deploy was manual, and nobody said so. Merging is not shipping unless
  something is actually watching `main`.
- **A code comment claimed Arabic-Indic digits** where the chosen locale produces Latin ones.
  Generic `ar` resolves to `latn` in CLDR. The comment was written from expectation rather
  than from running it.

Report honestly, including what you got wrong. Every entry above was cheaper to
state than to leave for the next session to discover.

---

## Rules that stuck

- **Invisible records return 404, never 403.** A 403 confirms the record exists.
- **Scope narrows, never refuses.** An employee filtering by someone else's id gets
  an empty list, not an error.
- **The frontend never *offers* a move the API would refuse** — and a cross-workspace
  test imports the backend's transition table and fails if the two drift.
- **User-facing text never carries a database id.**
- **Hiding a nav link is not access control.** Gate the route too.
- **Permission is a relation** (requester / assignee / manager), not a role.
- **One road out for anything sensitive.** Comments never ride on a request payload,
  so exactly one method filters internal notes instead of six routes each remembering to.
- **Anything ambiguous in the PRD gets decided in writing**, in the load-bearing table
  in HANDOFF.md — an undocumented decision is indistinguishable from a bug.

---

## Local gotcha

`npm run dev:*` spawns `ts-node-dev` and `vite` children that survive being stopped
from the agent harness. They accumulate and hold file locks — this broke an `npm ci`
once. Kill them **by command line**, never blanket-kill node:

```bash
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*HelpDeskLite*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
```
