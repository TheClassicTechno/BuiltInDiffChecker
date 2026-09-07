import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { runCli } from "./helpers/runCli.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("`diffcheck list` prints all checkpoints, in creation order", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    const first = await runCli(repo.path, ["checkpoint", "before task"]);
    const second = await runCli(repo.path, ["checkpoint", "after task"]);
    const firstId = first.stdout.trim();
    const secondId = second.stdout.trim();

    const list = await runCli(repo.path, ["list"]);
    assert.equal(list.code, 0);

    const lines = list.stdout.trim().split("\n");
    assert.equal(lines.length, 2);
    assert.ok(lines[0]!.includes(firstId));
    assert.ok(lines[0]!.includes("before task"));
    assert.ok(lines[1]!.includes(secondId));
    assert.ok(lines[1]!.includes("after task"));
  } finally {
    await repo.cleanup();
  }
});
