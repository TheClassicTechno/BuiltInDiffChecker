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

test("`--ignore-whitespace` hides a whitespace-only change while the default view still shows it", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "line one\nline two\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);
    const before = (await runCli(repo.path, ["checkpoint", "before task"])).stdout.trim();

    await writeFile(path.join(repo.path, "a.txt"), "line one  \nline two\n");
    const after = (await runCli(repo.path, ["checkpoint", "after task"])).stdout.trim();

    const defaultResult = await runCli(repo.path, ["compare", before, after, "--json"]);
    const defaultJson = JSON.parse(defaultResult.stdout);
    assert.equal(defaultJson.files.length, 1);

    const ignoreResult = await runCli(repo.path, ["compare", before, after, "--json", "--ignore-whitespace"]);
    const ignoreJson = JSON.parse(ignoreResult.stdout);
    assert.equal(ignoreJson.files.length, 0);
  } finally {
    await repo.cleanup();
  }
});
