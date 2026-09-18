#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { fake } from "./fake.ts";
import { gemini } from "./gemini.ts";
import type { Provider } from "./provider.ts";
import { readSession, writeSession } from "./sessions.ts";

/**
 * **The bridge is an ACP agent.** `isocan rc` already answers for enrolled
 * agents: it hears the summons, shows her face on the thread, queues a second
 * mention behind a running turn, keeps her session id, and says a failure on
 * the thread. It speaks Agent Client Protocol over stdio to whatever command
 * `~/.isocan/config.json` declares under `acpAdapters`. So this program is
 * that command and nothing more: it turns `session/new`, `session/load`,
 * `session/prompt` and `session/cancel` into a provider's start, continue and
 * cancel, and streams the provider's steps back as `session/update`.
 *
 * The rc starts one adapter per turn, so nothing is held in memory that the
 * next turn needs: `sessions.ts` keeps the ids.
 */

/** `ISOCANNERY_PROVIDER=fake` proves the wire with no model and no key. */
const provider: Provider = process.env["ISOCANNERY_PROVIDER"] === "fake" ? fake : gemini();

/** The turn in flight per session, so `session/cancel` has something to end. */
const running = new Map<string, AbortController>();

/** Session ids are ours, not the provider's: a provider's ids change with
 * every turn, and the rc stores one handle per agent. */
const newSessionId = (): string => randomBytes(16).toString("hex");

const textOf = (prompt: acp.PromptRequest["prompt"]): string =>
  prompt.map((block) => (block.type === "text" ? block.text : "")).join("");

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

acp
  .agent({ name: "isocannery" })
  .onRequest("initialize", () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: true },
  }))
  .onRequest("session/new", async (ctx) => {
    const sessionId = newSessionId();
    await writeSession(sessionId, { ...(await provider.start(ctx.params.cwd)), cwd: ctx.params.cwd });
    return { sessionId };
  })
  .onRequest("session/load", async (ctx) => {
    // No history is replayed: the rc wants the handle, and the conversation's
    // memory is the provider's. An unknown id is refused, and the rc falls
    // back to `session/new`.
    if (!(await readSession(ctx.params.sessionId))) {
      throw acp.RequestError.resourceNotFound(ctx.params.sessionId);
    }
    return {};
  })
  .onRequest("session/prompt", async (ctx) => {
    const { sessionId } = ctx.params;
    const stored = await readSession(sessionId);
    if (!stored) throw acp.RequestError.resourceNotFound(sessionId);
    const { cwd = process.cwd(), ...conversation } = stored;
    const abort = new AbortController();
    running.set(sessionId, abort);
    try {
      const next = await provider.continue(conversation, {
        text: textOf(ctx.params.prompt),
        cwd,
        signal: abort.signal,
        onStep: (step) =>
          void ctx.client.notify(acp.methods.client.session.update, {
            sessionId,
            update:
              step.kind === "tool"
                ? { sessionUpdate: "tool_call", toolCallId: step.id, title: step.title, kind: "execute", status: "in_progress" }
                : { sessionUpdate: "agent_message_chunk", content: { type: "text", text: step.text } },
          }),
      });
      await writeSession(sessionId, { ...next, cwd });
      return { stopReason: "end_turn" as const };
    } catch (err) {
      if (abort.signal.aborted) return { stopReason: "cancelled" as const };
      throw err;
    } finally {
      running.delete(sessionId);
    }
  })
  .onNotification("session/cancel", (ctx) => {
    running.get(ctx.params.sessionId)?.abort();
  })
  .connect(stream);
