import { parseArgs } from "node:util";
import { createCheckpoint } from "./checkpoint.ts";
import { DiffCheckError } from "./errors.ts";

async function runCheckpoint(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      note: { type: "string" },
    },
    allowPositionals: true,
  });

  const name = positionals[0];
  if (!name) {
    process.stderr.write("Usage: diffcheck checkpoint <name> [--note <text>]\n");
    return 1;
  }

  const checkpoint = await createCheckpoint(process.cwd(), name, values.note);
  process.stdout.write(`${checkpoint.id}\n`);
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  switch (command) {
    case "checkpoint":
      return runCheckpoint(rest);
    case undefined:
    case "--help":
    case "-h":
      process.stdout.write("Usage: diffcheck <command> [options]\n\nCommands:\n  checkpoint <name> [--note <text>]\n");
      return command === undefined ? 1 : 0;
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      return 1;
  }
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err: unknown) => {
      if (err instanceof DiffCheckError) {
        process.stderr.write(`${err.message}\n`);
        process.exitCode = err.code;
        return;
      }
      throw err;
    });
}
