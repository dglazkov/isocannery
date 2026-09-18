# isocannery

A person mentions an agent on an [isocan](https://isocan.io) canvas and gets a
reply in under a minute. Google hosts the agent's loop and its sandbox (Managed
Agents in the Gemini API); this repo is the thin bridge between the canvas and
the agent, in Node and TypeScript on Google Cloud.

Nothing is built yet. [docs/design.md](docs/design.md) is the design: the
journey it is judged by, the stack, the open decisions, and the spike that comes
before any bridge code. [AGENTS.md](AGENTS.md) is how work is done here.

isocannery follows [sheep](https://github.com/dglazkov/sheep), which ran its
own agents on Cloudflare and was frozen on 18 Sep 2026. What sheep learned is
in the design's first and last sections.
