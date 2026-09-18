import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Conversation, Provider, TurnRequest } from "./provider.ts";

/**
 * A provider with no model and no sandbox, to prove the path from a mention
 * through the rc to this adapter and back onto the thread. It counts its
 * turns so a resumed session can be told from a new one, and it answers
 * with the local `isocan`, under the identity the rc injected. The real
 * provider replies from the hosted sandbox instead; this file goes when it
 * lands.
 */
export const fake: Provider = {
  async start() {
    return { turns: "0" };
  },

  async continue(conversation: Conversation, turn: TurnRequest) {
    const turns = Number(conversation["turns"] ?? "0") + 1;
    const words = `isocannery's fake turn ${turns}: the rc reached the adapter, and no model ran.`;
    // The summons carries the thread: the payload is the JSON `isocan wait` returns.
    const threadId = /"threadId":\s*"([^"]+)"/.exec(turn.text)?.[1];
    if (threadId) {
      turn.onStep({ kind: "tool", id: `reply-${turns}`, title: `isocan comment reply ${threadId}` });
      await promisify(execFile)("isocan", ["comment", "reply", threadId, words], {
        cwd: turn.cwd,
        signal: turn.signal,
      });
    }
    turn.onStep({ kind: "text", text: words });
    return { turns: String(turns) };
  },
};
