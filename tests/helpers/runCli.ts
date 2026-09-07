import { execFile } from "node:child_process";
import path from "node:path";

const cliPath = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");

export interface CliResult {
  stdout: string;
  stderr: string;
  code: number;
}

export function runCli(cwd: string, args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile("node", [cliPath, ...args], { cwd }, (error, stdout, stderr) => {
      const code = error && "code" in error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      resolve({ stdout, stderr, code });
    });
  });
}
