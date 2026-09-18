import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { expect, test } from "vitest";

const adapter = path.join(import.meta.dirname, "../src/adapter.ts");

/** One adapter process, as the rc starts one per turn. */
async function withAdapter<T>(
  home: string,
  body: (ctx: acp.ClientContext) => Promise<T>,
  heard: string[] = [],
  env: Record<string, string> = {},
): Promise<T> {
  const child = spawn(process.execPath, [adapter], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, ISOCANNERY_HOME: home, ISOCANNERY_PROVIDER: "fake", ...env },
  });
  const stream = acp.ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout));
  try {
    return await acp
      .client({ name: "test" })
      .onNotification(acp.methods.client.session.update, (ctx) => {
        const { update } = ctx.params;
        if (update.sessionUpdate === "agent_message_chunk" && update.content.type === "text") heard.push(update.content.text);
      })
      .connectWith(stream, async (ctx) => {
        await ctx.request(acp.methods.agent.initialize, { protocolVersion: acp.PROTOCOL_VERSION });
        return body(ctx);
      });
  } finally {
    child.kill();
  }
}

const say = (ctx: acp.ClientContext, sessionId: string) =>
  ctx.request(acp.methods.agent.session.prompt, { sessionId, prompt: [{ type: "text", text: "hello" }] });

test("a session started by one adapter continues in the next", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "isocannery-"));
  const heard: string[] = [];

  const sessionId = await withAdapter(home, async (ctx) => {
    const session = await ctx.request(acp.methods.agent.session.new, { cwd: home, mcpServers: [] });
    expect((await say(ctx, session.sessionId)).stopReason).toBe("end_turn");
    return session.sessionId;
  }, heard);

  await withAdapter(home, async (ctx) => {
    await ctx.request(acp.methods.agent.session.load, { sessionId, cwd: home, mcpServers: [] });
    expect((await say(ctx, sessionId)).stopReason).toBe("end_turn");
  }, heard);

  expect(heard.map((words) => /turn (\d+)/.exec(words)?.[1])).toEqual(["1", "2"]);
});

test("an unknown session is refused, so the rc falls back to a new one", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "isocannery-"));
  await withAdapter(home, async (ctx) => {
    await expect(
      ctx.request(acp.methods.agent.session.load, { sessionId: "0".repeat(32), cwd: home, mcpServers: [] }),
    ).rejects.toThrow();
  });
});

test("a new session for an agent we know carries her conversation on", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "isocannery-"));
  const heard: string[] = [];
  const asHer = { ISOCANNERY_FAKE_ACTOR: "usr_her" };
  const fresh = async (ctx: acp.ClientContext) => {
    const session = await ctx.request(acp.methods.agent.session.new, { cwd: home, mcpServers: [] });
    await say(ctx, session.sessionId);
  };

  await withAdapter(home, fresh, heard, asHer);
  // Dismissed and added again: the rc has lost its handle and asks for a new one.
  await withAdapter(home, fresh, heard, asHer);
  await withAdapter(home, fresh, heard, { ISOCANNERY_FAKE_ACTOR: "usr_someone_else" });

  expect(heard.map((words) => /turn (\d+)/.exec(words)?.[1])).toEqual(["1", "2", "1"]);
});
