import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Conversation } from "./provider.ts";

/**
 * The rc starts a fresh adapter for every turn and hands back the session id
 * it stored, so the ids a conversation continues from live on disk between
 * turns: one small file per session, holding ids and no transcript.
 */

const dir = (): string => process.env["ISOCANNERY_HOME"] ?? path.join(os.homedir(), ".isocannery");

const fileOf = (sessionId: string): string => {
  if (!/^[a-f0-9]{32}$/.test(sessionId)) throw new Error(`not a session id: ${sessionId}`);
  return path.join(dir(), "sessions", `${sessionId}.json`);
};

export async function readSession(sessionId: string): Promise<Conversation | null> {
  try {
    return JSON.parse(await fs.readFile(fileOf(sessionId), "utf8")) as Conversation;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeSession(sessionId: string, conversation: Conversation): Promise<void> {
  const file = fileOf(sessionId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(conversation, null, 2));
}

/** What the bridge knows about an agent that the rc does not: where her
 * badge went. Ids only; the badge itself is Google's to hold. */
export interface AgentRecord {
  /** The home her canvases live at, as an origin. */
  home: string;
  /** Her badge there, by id. */
  badgeId: string;
  /** The write-only credential at the provider that holds the badge. */
  credential: string;
}

export async function readAgent(actorId: string): Promise<AgentRecord | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(actorId)) throw new Error(`not an actor id: ${actorId}`);
  try {
    return JSON.parse(await fs.readFile(path.join(dir(), "agents", `${actorId}.json`), "utf8")) as AgentRecord;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
