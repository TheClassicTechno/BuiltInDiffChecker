import { test } from "node:test";
import assert from "node:assert/strict";
import { DiffCheckError } from "../src/errors.ts";

test("DiffCheckError carries code and message for each exit code", () => {
  const codes = [1, 2, 3, 4] as const;
  for (const code of codes) {
    const err = new DiffCheckError({ code, message: `error ${code}` });
    assert.ok(err instanceof Error);
    assert.ok(err instanceof DiffCheckError);
    assert.equal(err.code, code);
    assert.equal(err.message, `error ${code}`);
    assert.equal(err.cause, undefined);
  }
});

test("DiffCheckError carries an optional cause", () => {
  const underlying = new Error("underlying git failure");
  const err = new DiffCheckError({ code: 3, message: "git failed", cause: underlying });
  assert.equal(err.cause, underlying);
});
