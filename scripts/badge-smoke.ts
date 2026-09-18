#!/usr/bin/env node
// Spike question 5, by a back door: can `isocan` in the hosted sandbox speak
// as an agent whose badge only Google's egress proxy holds? One interaction,
// one script run verbatim, every event on a clock. It handles no secret: the
// credential is named by id, and the owner put the badge behind it. Spends
// the key.
//   badge-smoke.ts <credential-id> <home> <canvas-id> <thread-id>
import { GoogleGenAI } from "@google/genai";

const [credential, home, canvas, thread] = process.argv.slice(2);
if (!credential || !home || !canvas || !thread) {
  throw new Error("usage: badge-smoke.ts <credential-id> <home> <canvas-id> <thread-id>");
}

const script = `
set +e
step() { echo; echo "### $1"; shift; /usr/bin/time -f "### took %es, exit %x" "$@" 2>&1; }
step install npm install -g --no-fund --no-audit github:dglazkov/isocan#release
step version isocan --version
step direct isocan direct ${home}
step whoami isocan --canvas ${canvas} whoami
step reply isocan --canvas ${canvas} comment reply ${thread} "From Google's sandbox, with no badge in it."
echo "spike" > /tmp/spike.md
step add isocan --canvas ${canvas} add /tmp/spike.md
echo; echo "### what the sandbox holds"
env | grep -i -E "cred|isocan" | cut -c1-120
ls -la ~/.isocan 2>/dev/null
`;

const client = new GoogleGenAI({});
const t0 = Date.now();
const at = (): string => `${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`;
const stream = await client.interactions.create({
  agent: "antigravity-preview-09-2026",
  stream: true,
  input:
    "Run this bash script exactly as written, in one shell call, and reply with the single word done. " +
    `Change nothing and retry nothing.\n\`\`\`bash${script}\`\`\``,
  environment: {
    type: "remote",
    network: { allowlist: [{ domain: new URL(home).hostname, credential }, { domain: "*" }] },
  },
});
let environment = "";
for await (const event of stream) {
  if (event.event_type === "interaction.created") {
    environment = (event.interaction as { environment_id?: string }).environment_id ?? "";
  }
  if (event.event_type === "step.start" && event.step.type === "code_execution_result") {
    console.log(`${at()}  result\n${(event.step as { result?: string }).result}`);
  } else if (event.event_type !== "step.delta" && event.event_type !== "step.stop") {
    console.log(`${at()}  ${event.event_type}  ${JSON.stringify(event).slice(0, 300)}`);
  }
}
if (environment) await client.environments.delete(environment);
console.log(`${at()}  environment ${environment} deleted`);
