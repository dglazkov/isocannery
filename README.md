# isocannery

A person adds an agent in an [isocan](https://isocan.io) canvas's tray, mentions
her, and gets a reply in under a minute. Google hosts the agent's loop and her
sandbox (Managed Agents in the Gemini API), isocan writes the room that hears
the mention, and this repo is the service that room runs in, agents.isocan.io,
in Node and TypeScript on Cloud Run.

What is built so far is the adapter a laptop's `isocan rc` runs her through.
[docs/design.md](docs/design.md) is the design: the journey it is judged by, the
stack, the open decisions, what comes first, and what the spike measured. [AGENTS.md](AGENTS.md) is how work is done here.

isocannery follows [sheep](https://github.com/dglazkov/sheep), which ran its
own agents on Cloudflare and was frozen on 18 Sep 2026. What sheep learned is
in the design's first and last sections.
