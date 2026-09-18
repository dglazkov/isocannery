import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { GoogleGenAI } from "@google/genai";
import type { Conversation, Provider, TurnRequest } from "./provider.ts";
import { readAgent } from "./sessions.ts";

/**
 * **Gemini Managed Agents, behind the three verbs.** Google runs the loop and
 * the sandbox; a turn here is one streamed interaction, continued by
 * `previous_interaction_id` in the environment the first turn made.
 *
 * What the 18 Sep 2026 spike found, and this file is built on:
 * - An environment is born by the first interaction that names none, with
 *   its sources mounted. There is no setup hook, so `isocan` is installed by
 *   her first shell call (`agent/env.sh`, about 35 s, once).
 * - Her badge never enters the sandbox. It sits at Google as a write-only
 *   credential, and the environment's allowlist has the egress proxy set it
 *   on every request to her home. The sandbox gets her public ids and a
 *   placeholder, because the CLI refuses locally without an identity.
 * - The stock agent reads `/.agents/AGENTS.md` by itself; there is no agent
 *   object to create or version.
 * - `interactions.cancel` is for background interactions. A streamed turn is
 *   cancelled by aborting its request.
 */

const AGENT = "antigravity-preview-09-2026";
const PLACEHOLDER = "held-by-the-egress-proxy";

/** The part of `@google/genai` this file calls, so a test can stand in for it. */
export interface InteractionsClient {
  interactions: {
    create(params: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<AsyncIterable<InteractionEvent>>;
  };
}

/** The streamed events this file reads, as the spike saw them. */
export interface InteractionEvent {
  event_type: string;
  interaction?: { id: string; environment_id?: string; status?: string; usage?: { total_tokens?: number } };
  step?: { type: string; arguments?: { code?: string } };
  delta?: { type?: string; text?: string };
  error?: { message?: string; code?: string };
}

const brief = (file: string): Promise<string> => readFile(path.join(import.meta.dirname, "../agent", file), "utf8");

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? `{{${key}}}`);

/** A new sandbox for her: the brief, the network line, and who she is there. */
async function newEnvironment(conversation: Conversation): Promise<Record<string, unknown>> {
  const { home = "", badgeId = "", credential = "", actorId = "", name = "" } = conversation;
  const at = new Date().toISOString();
  const inline = (target: string, content: string) => ({ type: "inline", target, content });
  return {
    type: "remote",
    sources: [
      inline("/.agents/AGENTS.md", fill(await brief("AGENTS.md"), { name, actorId, home })),
      inline("/.agents/env.sh", await brief("env.sh")),
      inline("/root/.isocan/config.json", JSON.stringify({ direct: home })),
      inline(
        "/root/.isocan/identity.json",
        JSON.stringify({ id: actorId, name, createdAt: at, auth: { [home]: { badgeId, secret: PLACEHOLDER, at } } }),
      ),
    ],
    network: { allowlist: [{ domain: new URL(home).hostname, credential }, { domain: "*" }] },
  };
}

/** A shell call as her face should say it: its first line that is not the
 * preamble every call carries. */
const titleOf = (code: string): string =>
  code.split("\n").map((line) => line.trim()).find((line) => line && !line.startsWith("source /.agents/env.sh") && !line.startsWith("#")) ?? "working in the shell";

const expired = (err: unknown): boolean =>
  (err as { status?: number; statusCode?: number }).status === 404 ||
  (err as { statusCode?: number }).statusCode === 404 ||
  /not[_ ]found/i.test(String((err as Error)?.message ?? ""));

export function geminiProvider(client: InteractionsClient): Provider {
  return {
    async start(cwd) {
      // The rc injected her identity into this process, so the local CLI says who she is.
      const { stdout } = await promisify(execFile)("isocan", ["whoami", "--json"], { cwd });
      const who = JSON.parse(stdout) as { id: string; name: string };
      const record = await readAgent(who.id);
      if (!record) {
        throw new Error(
          `${who.name} (${who.id}) has no badge with Google yet, so a sandbox could not speak as her. ` +
            `Whoever runs this rc mints one with \`isocan pass --agent ${who.name}\` and registers it as a credential.`,
        );
      }
      return { actorId: who.id, name: who.name, ...record };
    },

    async continue(conversation, turn: TurnRequest) {
      const t0 = Date.now();
      const timeline: Record<string, number | string> = {};
      const mark = (name: string): void => void (timeline[name] ??= Date.now() - t0);
      const canvas = process.env["ISOCAN_CANVAS"];
      const input = `${canvas ? `This summons is on canvas ${canvas}.\n\n` : ""}${turn.text}`;

      const open = async (environment: unknown) =>
        client.interactions.create(
          {
            agent: AGENT,
            input,
            stream: true,
            environment,
            ...(conversation["interaction"] ? { previous_interaction_id: conversation["interaction"] } : {}),
          },
          { signal: turn.signal },
        );
      const born = async () => {
        // A wait is said aloud: a new sandbox installs `isocan` before anything else.
        turn.onStep({ kind: "tool", id: "sandbox", title: "setting up a new sandbox, about 40 s, this once" });
        return open(await newEnvironment(conversation));
      };

      let stream: AsyncIterable<InteractionEvent>;
      if (!conversation["environment"]) {
        stream = await born();
      } else {
        // Deleted after seven idle days: make a new one and carry on. The
        // canvas is the memory; the sandbox was scratch.
        stream = await open(conversation["environment"]).catch((err) => {
          if (!expired(err)) throw err;
          return born();
        });
      }

      let { environment = "", interaction = "" } = conversation;
      let calls = 0;
      for await (const event of stream) {
        if (event.event_type === "interaction.created" && event.interaction) {
          mark("created");
          environment = event.interaction.environment_id ?? environment;
        } else if (event.event_type === "step.start" && event.step?.type === "code_execution_call") {
          mark("firstTool");
          turn.onStep({ kind: "tool", id: `call-${++calls}`, title: titleOf(event.step.arguments?.code ?? "") });
        } else if (event.event_type === "step.delta" && event.delta?.type === "text" && event.delta.text) {
          turn.onStep({ kind: "text", text: event.delta.text });
        } else if (event.event_type === "interaction.completed" && event.interaction) {
          mark("done");
          interaction = event.interaction.id;
          timeline["status"] = event.interaction.status ?? "?";
          timeline["tokens"] = event.interaction.usage?.total_tokens ?? 0;
        } else if (event.event_type === "error") {
          throw new Error(`Gemini ended the turn: ${event.error?.message ?? event.error?.code ?? "no reason given"}`);
        }
      }
      // One timeline line per turn, in ms from the summons reaching the adapter.
      console.error(JSON.stringify({ isocannery: "turn", name: conversation["name"], calls, ...timeline }));
      if (timeline["status"] !== "completed") {
        throw new Error(`Gemini ended the turn as "${timeline["status"] ?? "nothing"}", not completed.`);
      }
      return { ...conversation, environment, interaction };
    },
  };
}

/** The real thing: the key comes from the environment the rc passes through
 * (`GEMINI_*`), or from a `.env` beside this checkout. */
export function gemini(): Provider {
  if (!process.env["GEMINI_API_KEY"]) {
    try {
      process.loadEnvFile(path.join(import.meta.dirname, "../.env"));
    } catch {
      // no .env: the SDK says what is missing
    }
  }
  return geminiProvider(new GoogleGenAI({}) as unknown as InteractionsClient);
}
