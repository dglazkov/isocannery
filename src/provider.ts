/**
 * Everything that names a managed agent service sits behind this: start a
 * conversation, continue it by one turn, cancel the turn in flight. Gemini
 * Managed Agents is the first provider; Claude Managed Agents has the same
 * shape and would be the second.
 */

/** What a conversation is remembered by: ids that the provider's own
 * service resolves (an environment, the last interaction), and nothing the
 * bridge would have to keep alive itself. */
export type Conversation = Record<string, string>;

/** One thing the agent did, as the person watching the canvas would hear it. */
export type Step =
  | { kind: "tool"; id: string; title: string }
  | { kind: "text"; text: string };

export interface TurnRequest {
  /** The summons, as the rc worded it: the ask, the thread, the coordinates. */
  text: string;
  /** The agent's directory on the machine the rc runs on. */
  cwd: string;
  onStep(step: Step): void;
  /** Cancel is this signal: aborting it ends the turn in flight. */
  signal: AbortSignal;
}

export interface Provider {
  start(cwd: string): Promise<Conversation>;
  /** Returns the conversation as it stands after the turn, to be stored. */
  continue(conversation: Conversation, turn: TurnRequest): Promise<Conversation>;
}
