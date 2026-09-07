import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

export interface TempRepo {
  path: string;
  cleanup: () => Promise<void>;
}

async function git(repoPath: string, args: string[]): Promise<void> {
  await execFileAsync("git", ["-C", repoPath, ...args]);
}

export async function createTempRepo(): Promise<TempRepo> {
  const dir = await mkdtemp(path.join(tmpdir(), "diffcheck-test-"));

  await git(dir, ["init", "--quiet"]);
  // Fixed local identity so tests never depend on the developer's global
  // git config, and gpgsign disabled so commit-tree calls in later tasks
  // never block on a signing prompt regardless of global config.
  await git(dir, ["config", "user.name", "diffcheck-test"]);
  await git(dir, ["config", "user.email", "diffcheck-test@example.invalid"]);
  await git(dir, ["config", "commit.gpgsign", "false"]);

  return {
    path: dir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}
