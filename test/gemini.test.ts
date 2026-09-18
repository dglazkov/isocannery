import { expect, test } from "vitest";
import { geminiProvider, type InteractionEvent } from "../src/gemini.ts";
import type { Step } from "../src/provider.ts";

/** Events in the shape the 18 Sep 2026 spike printed. */
const turnOf = (id: string, environment: string, code: string): InteractionEvent[] => [
  { event_type: "interaction.created", interaction: { id, environment_id: environment, status: "in_progress" } },
  { event_type: "step.start", step: { type: "code_execution_call", arguments: { code } } },
  { event_type: "step.start", step: { type: "code_execution_result" } },
  { event_type: "step.delta", delta: { type: "text", text: "done" } },
  { event_type: "interaction.completed", interaction: { id, status: "completed", usage: { total_tokens: 12 } } },
];

const her = { actorId: "usr_x", name: "Greta", home: "https://dev.isocan.io", badgeId: "bdg_x", credential: "isocan-greta" };

test("the first turn makes her sandbox, and the second continues in it", async () => {
  const asked: Record<string, any>[] = [];
  const provider = geminiProvider({
    interactions: {
      async create(params) {
        asked.push(params);
        return (async function* () {
          yield* turnOf(`int_${asked.length}`, "env_1", 'source /.agents/env.sh\nisocan --canvas c comment reply t "hi"');
        })();
      },
    },
  });
  const steps: Step[] = [];
  const turn = { text: "summons", cwd: ".", onStep: (step: Step) => steps.push(step), signal: new AbortController().signal };

  const first = await provider.continue(her, turn);
  expect(first).toMatchObject({ environment: "env_1", interaction: "int_1" });
  const born = asked[0]!["environment"];
  expect(born.network.allowlist[0]).toEqual({ domain: "dev.isocan.io", credential: "isocan-greta" });
  expect(born.sources.map((s: { target: string }) => s.target)).toContain("/.agents/AGENTS.md");
  const identity = born.sources.find((s: { target: string }) => s.target === "/root/.isocan/identity.json").content;
  expect(JSON.parse(identity).auth["https://dev.isocan.io"].secret).toBe("held-by-the-egress-proxy");
  expect(steps[0]).toMatchObject({ kind: "tool", title: expect.stringContaining("new sandbox") });
  expect(steps[1]).toMatchObject({ kind: "tool", title: 'isocan --canvas c comment reply t "hi"' });

  const second = await provider.continue(first, turn);
  expect(asked[1]).toMatchObject({ environment: "env_1", previous_interaction_id: "int_1" });
  expect(second["interaction"]).toBe("int_2");
});

test("an expired sandbox is replaced, and the conversation carries on", async () => {
  const asked: Record<string, any>[] = [];
  const provider = geminiProvider({
    interactions: {
      async create(params) {
        asked.push(params);
        if (params["environment"] === "env_gone") throw Object.assign(new Error("not_found"), { status: 404 });
        return (async function* () {
          yield* turnOf("int_9", "env_new", "true");
        })();
      },
    },
  });
  const turn = { text: "summons", cwd: ".", onStep: () => {}, signal: new AbortController().signal };
  const next = await provider.continue({ ...her, environment: "env_gone", interaction: "int_8" }, turn);
  expect(next).toMatchObject({ environment: "env_new", interaction: "int_9" });
  expect(asked[1]).toMatchObject({ previous_interaction_id: "int_8", environment: { type: "remote" } });
});
