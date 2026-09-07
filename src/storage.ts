import { mkdir, writeFile, rename, readdir, readFile } from "node:fs/promises";
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

/**
 * Lists all persisted checkpoints, sorted by createdAt ascending. No
 * separate index/manifest file is used — the directory listing is the
 * source of truth, per DESIGN.md §3.
 */
export async function listCheckpoints(toplevel: string): Promise<Checkpoint[]> {
  const dir = checkpointsDir(toplevel);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const checkpoints = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map(async (entry) => {
        const raw = await readFile(path.join(dir, entry), "utf8");
        return JSON.parse(raw) as Checkpoint;
      }),
  );

  return checkpoints.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function readCheckpoint(toplevel: string, id: string): Promise<Checkpoint> {
  const raw = await readFile(path.join(checkpointsDir(toplevel), `${id}.json`), "utf8");
  return JSON.parse(raw) as Checkpoint;
}

/**
 * Whether the repo's .gitignore already has a line covering .diffcheck/.
 * Intentionally simple (exact-line match, not a full gitignore pattern
 * matcher) — good enough to decide whether to print a one-time suggestion,
 * never used to decide what's actually excluded from checkpoint content
 * (buildTree's unconditional exclusion, DESIGN.md §3, is the real guard).
 */
export async function isDiffcheckGitignored(toplevel: string): Promise<boolean> {
  let content: string;
  try {
    content = await readFile(path.join(toplevel, ".gitignore"), "utf8");
  } catch {
    return false;
  }
  return content.split("\n").some((line) => line.trim().replace(/\/$/, "") === ".diffcheck");
}
