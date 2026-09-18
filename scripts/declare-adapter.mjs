#!/usr/bin/env node
// Declare this checkout's adapter to `isocan rc`, as the harness "isocannery":
// one key merged into ~/.isocan/config.json, everything else left as it was.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const home = process.env.ISOCAN_HOME ?? path.join(os.homedir(), ".isocan");
const file = path.join(home, "config.json");
const adapter = path.join(import.meta.dirname, "../src/adapter.ts");

let config = {};
try {
  config = JSON.parse(await readFile(file, "utf8"));
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}
config.acpAdapters = { ...config.acpAdapters, isocannery: ["node", adapter] };
await mkdir(home, { recursive: true });
await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(`isocannery → node ${adapter}, declared in ${file}`);
