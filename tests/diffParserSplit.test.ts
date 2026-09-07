import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { splitUnifiedDiffByFile } from "../src/diffParser.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("splitUnifiedDiffByFile splits a multi-file diff losslessly, in git's own order", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "f1.txt"), "x\n");
    await writeFile(path.join(repo.path, "f2.txt"), "y\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);

    await writeFile(path.join(repo.path, "f1.txt"), "x\nz\n");
    await writeFile(path.join(repo.path, "f2.txt"), "y\nw\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "changes"]);

    const raw = await git(repo.path, ["diff", "--no-color", "-M", "HEAD~1", "HEAD"]);
    const chunks = splitUnifiedDiffByFile(raw);

    assert.equal(chunks.length, 2);
    assert.ok(chunks[0]!.startsWith("diff --git a/f1.txt b/f1.txt"));
    assert.ok(chunks[1]!.startsWith("diff --git a/f2.txt b/f2.txt"));
    assert.equal(chunks.join("\n"), raw);
  } finally {
    await repo.cleanup();
  }
});

test("splitUnifiedDiffByFile returns an empty array for an empty diff", () => {
  assert.deepEqual(splitUnifiedDiffByFile(""), []);
});
