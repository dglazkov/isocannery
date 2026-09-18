#!/usr/bin/env node
// A back-door smoke of Gemini Managed Agents: two interactions in one fresh
// environment, every streamed event printed against a clock. It measures the
// machine, not the journey, and spends the key: run it on the owner's word.
import { GoogleGenAI } from "@google/genai";

const AGENT = "antigravity-preview-09-2026";
const client = new GoogleGenAI({});
const t0 = Date.now();
const at = (): string => `${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`;
const brief = (value: unknown): string => {
  const words = JSON.stringify(value);
  return words.length > 400 ? `${words.slice(0, 400)}…` : words;
};

async function turn(input: string, previous?: { id: string; environment: string }) {
  console.log(`${at()}  → ${input}`);
  const stream = await client.interactions.create({
    agent: AGENT,
    input,
    stream: true,
    ...(previous
      ? { previous_interaction_id: previous.id, environment: previous.environment }
      : { environment: { type: "remote" } }),
  });
  let done: { id: string; environment: string } | undefined;
  for await (const event of stream) {
    console.log(`${at()}  ${event.event_type}  ${brief(event)}`);
    if (event.event_type === "interaction.completed") {
      const { id, environment_id } = event.interaction as { id: string; environment_id?: string };
      done = { id, environment: environment_id ?? previous?.environment ?? "" };
    }
  }
  if (!done) throw new Error("the stream ended with no interaction.completed");
  return done;
}

const first = await turn("Run `node --version && echo hello` in the shell and reply with its output. Nothing else.");
const second = await turn(
  "Run `time curl -s -o /dev/null -w '%{http_code}' https://dev.isocan.io/` and `time npm --version`, and reply with the outputs and timings. Nothing else.",
  first,
);
console.log(`${at()}  environment ${second.environment}`);
await client.environments.delete(second.environment);
console.log(`${at()}  environment deleted`);
