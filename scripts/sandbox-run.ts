#!/usr/bin/env node
// Run one bash file verbatim in a fresh hosted sandbox and print what it
// printed, on a clock: the spike's probe for questions about the sandbox
// itself. With a credential id, the sandbox's requests to <domain> carry it.
// A back door that spends the key.
//   sandbox-run.ts <script.sh> [<domain> <credential-id>]
import { readFile } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";

const [file, domain, credential] = process.argv.slice(2);
if (!file) throw new Error("usage: sandbox-run.ts <script.sh> [<domain> <credential-id>]");
const script = await readFile(file, "utf8");

const client = new GoogleGenAI({});
const t0 = Date.now();
const at = (): string => `${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`;
const stream = await client.interactions.create({
  agent: "antigravity-preview-09-2026",
  stream: true,
  input:
    "Run this bash script exactly as written, in one shell call, and reply with the single word done. " +
    `Change nothing and retry nothing.\n\`\`\`bash\n${script}\n\`\`\``,
  environment: {
    type: "remote",
    ...(domain && credential ? { network: { allowlist: [{ domain, credential }, { domain: "*" }] } } : {}),
  },
});
let environment = "";
for await (const event of stream) {
  if (event.event_type === "interaction.created") {
    environment = (event.interaction as { environment_id?: string }).environment_id ?? "";
    console.log(`${at()}  environment ${environment}`);
  }
  if (event.event_type === "step.start" && event.step.type === "code_execution_result") {
    console.log(`${at()}  result\n${(event.step as { result?: string }).result}`);
  }
  if (event.event_type === "error") console.log(`${at()}  error ${JSON.stringify(event)}`);
}
if (environment) await client.environments.delete(environment);
console.log(`${at()}  done, environment deleted`);
