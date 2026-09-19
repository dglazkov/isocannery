#!/usr/bin/env node
// What she did in her latest turn: the shell calls and their results, read
// back from Google by the newest session's interaction id. A read; it spends
// no model tokens.   steps.ts [<interaction-id>]
import { readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const dir = path.join(process.env["ISOCANNERY_HOME"] ?? path.join(os.homedir(), ".isocannery"), "sessions");
const newest = (): string => {
  const files = readdirSync(dir).map((name) => path.join(dir, name));
  const file = files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!file) throw new Error(`no sessions in ${dir}`);
  return (JSON.parse(readFileSync(file, "utf8")) as { interaction: string }).interaction;
};

const oneLine = (value: unknown, most: number): string => String(value ?? "").replace(/\n/g, " ⏎ ").slice(0, most);
const got = await new GoogleGenAI({}).interactions.get(process.argv[2] ?? newest());
for (const [index, step] of ((got.steps ?? []) as { type: string; arguments?: { code?: string }; result?: string; exit_code?: number }[]).entries()) {
  if (step.type === "code_execution_call") console.log(`\n[${index}] CALL  ${oneLine(step.arguments?.code, 400)}`);
  else if (step.type === "code_execution_result") console.log(`[${index}] → exit ${step.exit_code}  ${oneLine(step.result, 300)}`);
  else console.log(`[${index}] ${step.type}`);
}
