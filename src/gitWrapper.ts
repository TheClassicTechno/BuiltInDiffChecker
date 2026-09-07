import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DiffCheckError } from "./errors.ts";

const execFileAsync = promisify(execFile);

export interface RepoInfo {
  toplevel: string;
  hasHead: boolean;
}

async function runGit(cwd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd, env });
  return stdout;
}

export async function detectRepo(cwd: string): Promise<RepoInfo> {
  let toplevel: string;
  try {
    toplevel = (await runGit(cwd, ["rev-parse", "--show-toplevel"])).trim();
  } catch (cause) {
    throw new DiffCheckError({
      code: 2,
      message: `Not a Git repository (or any parent directory): ${cwd}`,
      cause,
    });
  }

  let hasHead = true;
  try {
    await runGit(toplevel, ["rev-parse", "--verify", "HEAD"]);
  } catch {
    hasHead = false;
  }

  return { toplevel, hasHead };
}

/**
 * Snapshots the repo's current tracked+untracked (non-ignored) state into a
 * tree object, via a scratch index that never touches the real index or
 * working tree. See DESIGN.md §4.
 */
export async function buildTree(toplevel: string, hasHead: boolean): Promise<string> {
  const scratchDir = await mkdtemp(path.join(tmpdir(), "diffcheck-index-"));
  const indexFile = path.join(scratchDir, "index");
  const env = { ...process.env, GIT_INDEX_FILE: indexFile };
  try {
    if (hasHead) {
      await runGit(toplevel, ["read-tree", "HEAD"], env);
    }
    await runGit(toplevel, ["add", "-A", "--", "."], env);
    const treeSha = (await runGit(toplevel, ["write-tree"], env)).trim();
    return treeSha;
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
}

/**
 * Creates a commit object wrapping treeSha, optionally linked to a parent
 * checkpoint commit for future traversal. Never attaches to HEAD or any
 * branch ref. See DESIGN.md §4 step 5.
 */
export async function commitTree(
  toplevel: string,
  treeSha: string,
  message: string,
  parentCommitSha?: string,
): Promise<string> {
  const args = ["commit-tree", treeSha];
  if (parentCommitSha) {
    args.push("-p", parentCommitSha);
  }
  args.push("-m", message);
  return (await runGit(toplevel, args)).trim();
}
