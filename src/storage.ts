import { mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import type { Checkpoint } from "./types.ts";

function checkpointsDir(toplevel: string): string {
  return path.join(toplevel, ".diffcheck", "checkpoints");
}

/**
 * Writes a checkpoint record via write-to-tmp then atomic rename, so a
 * crash mid-write can never corrupt or half-write a checkpoint file.
 * See DESIGN.md §3.
 */
export async function writeCheckpoint(toplevel: string, checkpoint: Checkpoint): Promise<void> {
  const dir = checkpointsDir(toplevel);
  await mkdir(dir, { recursive: true });

  const finalPath = path.join(dir, `${checkpoint.id}.json`);
  const tmpPath = `${finalPath}.tmp`;

  await writeFile(tmpPath, JSON.stringify(checkpoint, null, 2), "utf8");
  await rename(tmpPath, finalPath);
}
