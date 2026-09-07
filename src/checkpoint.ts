import { randomUUID } from "node:crypto";
import { detectRepo, buildTree, commitTree, updateCheckpointRef } from "./gitWrapper.ts";
import { listCheckpoints, writeCheckpoint } from "./storage.ts";
import type { Checkpoint } from "./types.ts";

/**
 * Creates a checkpoint of the current tracked+untracked working state.
 * Non-destructive: does not touch the real index, working tree, HEAD, or
 * any branch. See DESIGN.md §4/§10 (Task 10).
 */
export async function createCheckpoint(cwd: string, name: string, note?: string): Promise<Checkpoint> {
  const { toplevel, hasHead } = await detectRepo(cwd);

  const existing = await listCheckpoints(toplevel);
  const parent = existing.at(-1);

  const treeSha = await buildTree(toplevel, hasHead);
  const commitSha = await commitTree(toplevel, treeSha, name, parent?.commitSha);

  const checkpoint: Checkpoint = {
    id: randomUUID(),
    name,
    ...(note !== undefined ? { note } : {}),
    createdAt: new Date().toISOString(),
    commitSha,
    ...(parent ? { parentCheckpointId: parent.id } : {}),
  };

  await updateCheckpointRef(toplevel, checkpoint.id, commitSha);
  await writeCheckpoint(toplevel, checkpoint);

  return checkpoint;
}
