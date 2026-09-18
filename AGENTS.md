# House rules

This repo is isocannery: a bridge between an isocan canvas and a Gemini managed
agent, so a person who mentions an agent on a canvas gets a reply in under a
minute. Google hosts the agent's loop and its sandbox; this repo owns the
bridge and the agent's brief, and nothing else. [docs/design.md](docs/design.md)
is the design, the journey it is judged by, the open decisions, and the spike
that comes before any code. Read it first. It is the one design doc; keep it
current in the commit that changes what it says.

## How we work

- **The owner decides, the agent writes.** Propose in a sentence, ask when a
  choice is theirs, do exactly that. No unattended runs of work.
- **Work comes from chat and from open issues.** No project plans, phase
  docs, findings logs or status lines. If a thing needs remembering, it is a
  sentence in the design, an issue, or a commit message.
- **Small commits, straight to main, verified narrowly.** Typecheck, the
  tests the change touches, a dry run where it is cheap. Watch CI on every
  push and fix red before anything else.
- **Pace is measured.** Read only what a change needs. No surveys of the
  codebase, no subagents for what a grep answers.
- **Every wait is bounded.** A background wait has a deadline near the
  expected duration and reports when it passes.
- **A failure is a set of findings.** Fix the cause on every side it
  touches; never just get the run unstuck.

## Walks

A walk is the journey in the design, taken the way a person takes it.

- **A plan first**: numbered steps, a time per step, every wait named and
  why. The owner confirms before it runs.
- **No shortcuts.** A step taken by a route a person would not take (an API
  call instead of the page, a record written by hand, a throwaway identity)
  is a step not walked. Say so, file it, and never call such a walk held.
- **Time is read off the person's clock**: from the mention to the reply on
  the canvas. Judge every screen and sentence as a newcomer would.

## What this repo refuses to grow

- An agent loop, a harness, or a transcript store of its own.
- A sandbox lifecycle: leases, sockets to a container, file sync, caches.
  If the hosted sandbox cannot do the job, stop and say so.
- A second product: herds, shared trees, dashboards.
- A test that passes by a route a person would not take.
- Silence: every wait is announced on the thread, every refusal names who
  and why, every failure reaches the person who asked.

## Secrets and money

- **Secrets are typed, never read.** Never print, cat, or parse a
  credentials file into output; pass a secret from its store to the process
  that needs it without it crossing the agent's context. One bridge holds
  other people's keys: every record and secret sits under its owner's id.
- **Nothing in the cloud that costs money or is hard to undo without the
  owner's word**, each time: deploys, new services, deletes, anything that
  spends a Gemini key.

## Commands

- `pnpm typecheck` and `pnpm test`.
- Run: there is nothing to start. `isocan rc` starts `src/adapter.ts` per turn,
  once `node scripts/declare-adapter.mjs` has declared it in
  `~/.isocan/config.json` and an agent is enrolled with
  `isocan rc add <name> --harness isocannery`.
- Walks run in a codespace (`.devcontainer`), so every install is from
  nothing and the teardown is one delete. Creating one costs money: the
  owner's word, each time.
