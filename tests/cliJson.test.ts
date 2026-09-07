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

test("`--json` on list and compare produces parseable output matching the documented shapes", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    const before = (await runCli(repo.path, ["checkpoint", "before task"])).stdout.trim();
    await writeFile(path.join(repo.path, "a.txt"), "two\n");
    const after = (await runCli(repo.path, ["checkpoint", "after task"])).stdout.trim();

    const listResult = await runCli(repo.path, ["list", "--json"]);
    assert.equal(listResult.code, 0);
    const listJson = JSON.parse(listResult.stdout);
    assert.equal(listJson.length, 2);
    assert.equal(listJson[0].id, before);
    assert.equal(listJson[0].name, "before task");

    const compareResult = await runCli(repo.path, ["compare", before, after, "--json"]);
    assert.equal(compareResult.code, 0);
    const compareJson = JSON.parse(compareResult.stdout);
    assert.equal(compareJson.from.id, before);
    assert.equal(compareJson.to.id, after);
    assert.equal(compareJson.files[0].path, "a.txt");
    assert.equal(compareJson.totalAdditions, 1);
    assert.equal(compareJson.totalDeletions, 1);
    assert.ok(typeof compareJson.rawDiff === "string");
  } finally {
    await repo.cleanup();
  }
});
