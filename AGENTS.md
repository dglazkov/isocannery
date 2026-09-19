# House rules

This repo is isocannery, which runs as agents.isocan.io: the hosted place where
a canvas's agents live, so a person who adds an agent in a canvas's tray and
mentions her gets a reply in under a minute. Google hosts the agent's loop and
her sandbox, and isocan writes the room that hears the mention. This repo owns
the service that room runs in, the page that reads it, and the agent's brief.
[docs/design.md](docs/design.md) is the design, the journey it is judged by,
the open decisions, what comes first, and what the spike measured. Read it
first. It is the one design doc; keep it
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
- **The instrument comes first.** The moment something cannot be read where
  it runs, the tool that reads it is built before the next feature. Every
  record it keeps sits under its owner's id, so the person's page is the same
  tool, filtered.

## Walks

A walk is the journey in the design, taken the way a person takes it.

- **A plan first**: numbered steps, a time per step, every wait named and
  why. The owner confirms before it runs.
- **No shortcuts.** A step taken by a route a person would not take (an API
  call instead of the page, a record written by hand, a throwaway identity)
  is a step not walked. Say so, file it, and never call such a walk held.
- **Time is read off the person's clock**: from the mention to the reply on
  the canvas. Judge every screen and sentence as a newcomer would.

## The rig

The end-to-end rig is a codespace that runs `isocan rc` with this repo's
adapter, a real canvas in the owner's browser, and Gemini behind it. It first
held on 18 Sep 2026. It is the rig until the hosted room in the design has
held a walk of its own. Everything in it that costs money or touches a secret
needs the owner's word, each time.

**Stand it up**

1. `gh codespace create -R dglazkov/isocannery -b main -m basicLinux32gb
   --idle-timeout 60m --default-permissions`. The devcontainer brings Node 22,
   sshd and `pnpm install`.
2. The key: `gh secret set -f <main checkout>/.env --app codespaces -R
   dglazkov/isocannery`. gh reads the file; nobody prints it. Codespace
   secrets reach **login shells only**: run everything that needs the key as
   `gh codespace ssh -c <name> -- 'bash -l -s' <<'EOF' … EOF`, the rc included.
3. The owner makes a canvas, opens "Bring your own agent", and pastes its line
   into `gh codespace ssh`, in `/workspaces/isocannery`. That joins the machine
   to the canvas as them and installs `isocan` and its skill there.
4. `node scripts/declare-adapter.mjs`, then check `isocan harness` lists
   `isocannery` as runnable. It is the only harness there, so an agent added
   with none named runs on it.
5. Start the rc detached, with a log:
   `(ISOCAN_ADAPTER_STDERR=all nohup isocan rc > /tmp/rc.log 2>&1 < /dev/null &)`.
   `ISOCANNERY_PROVIDER=fake` in front of it proves the path with no model.
6. The owner adds an agent in the canvas's tray and names her.
7. Her badge, by hand, **on the owner's explicit word in chat** (it moves a
   secret into a store, and the permission classifier refuses it otherwise).
   In one login shell, printing no secret: mint `isocan pass --agent <name>
   --json` into a variable; redeem it into a scratch home with
   `ISOCAN_HOME=$S isocan setup --direct --no-open --no-install "$ADDR"` from an
   empty directory; check `ISOCAN_HOME=$S isocan whoami` names her; hand
   `<badgeId>.<secret>` from `$S/identity.json`'s `auth` block to
   `client.credentials.create({ id, type: "bearer_token", token })`; delete
   `$S`. Then write her record, ids only, to
   `~/.isocannery/agents/<actorId>.json`: `home`, `badgeId`, `credential`.
8. The owner mentions her. Without step 7 the thread gets a sentence saying
   she has no badge with Google yet.

**Read it**

- `/tmp/rc.log`: the rc's narration, and one `{"isocannery":"turn",…}` line per
  turn with ms to created, first shell call and done, the calls, the tokens.
  That is the rc's clock; the time that counts is the owner's.
- `node scripts/steps.ts` (login shell): what she ran in her latest turn.
- `node scripts/sandbox-run.ts <script.sh> [<domain> <credential-id>]` runs a
  bash file in a fresh sandbox; `scripts/probes/` has the spike's. A back
  door: it measures the machine and walks nothing.
- A code change is live on the next turn after `git pull` in the codespace:
  the rc starts a fresh adapter per turn. A brief change reaches only a new
  sandbox: clear `environment` in her newest session file.

**Mind it**

- The idle timer counts ssh, not mentions on the canvas. Stop the codespace
  when nobody is walking (`gh codespace stop`); a stop keeps the join, her
  enrolment, her sessions and her record, and the rc is started again by hand.
- Teardown, on the owner's word: `isocan rc remove <name>`, delete the
  credential at Google, `isocan badges --kill <badgeId>`, delete the
  codespace, and the owner deletes the canvas.

## What this repo refuses to grow

- An agent loop, a harness, or a transcript store of its own.
- A sandbox lifecycle: leases, sockets to a container, file sync, caches.
  If the hosted sandbox cannot do the job, stop and say so.
- A test that passes by a route a person would not take.
- Silence: every wait is announced on the thread, every refusal names who
  and why, every failure reaches the person who asked.

## Secrets and money

- **Secrets are typed, never read.** Never print, cat, or parse a
  credentials file into output; pass a secret from its store to the process
  that needs it without it crossing the agent's context. One service answers
  for everyone: every record sits under its owner's id.
- **Nothing in the cloud that costs money or is hard to undo without the
  owner's word**, each time: deploys, new services, deletes, anything that
  spends a Gemini key.

## Commands

- `pnpm typecheck` and `pnpm test`.
- Run: there is nothing to start. `isocan rc` starts `src/adapter.ts` per turn,
  once `node scripts/declare-adapter.mjs` has declared it in
  `~/.isocan/config.json` and an agent is enrolled with
  `isocan rc add <name> --harness isocannery`.
- The adapter runs Gemini unless `ISOCANNERY_PROVIDER=fake`. An agent needs a
  record at `~/.isocannery/agents/<actorId>.json` (`home`, `badgeId`,
  `credential`: ids only) naming the Google credential that holds her badge.
  `agent/` is her brief, mounted into each new sandbox.
- Walks run on the rig above.
