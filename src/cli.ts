import { parseArgs } from "node:util";
import { createCheckpoint } from "./checkpoint.ts";
import { detectRepo, diffCommits } from "./gitWrapper.ts";
import { buildComparison, compareAgainstWorking } from "./comparison.ts";
import { listCheckpoints } from "./storage.ts";
import { DiffCheckError } from "./errors.ts";
import type { Checkpoint, Comparison } from "./types.ts";

function resolveCheckpointRef(checkpoints: Checkpoint[], ref: string): Checkpoint {
  if (ref === "latest") {
    const latest = checkpoints.at(-1);
    if (!latest) {
      throw new DiffCheckError({
        code: 1,
        message: "No checkpoints exist yet. Run `diffcheck checkpoint <name>` first.",
      });
    }
    return latest;
  }

  const byId = checkpoints.find((c) => c.id === ref);
  if (byId) {
    return byId;
  }

  const byName = checkpoints.filter((c) => c.name === ref);
  if (byName.length === 1) {
    return byName[0]!;
  }
  if (byName.length > 1) {
    throw new DiffCheckError({
      code: 1,
      message: `Checkpoint name "${ref}" is ambiguous. Matching ids: ${byName.map((c) => c.id).join(", ")}`,
    });
  }

  throw new DiffCheckError({
    code: 1,
    message: `Unknown checkpoint reference "${ref}". Run \`diffcheck list\` to see available checkpoints.`,
  });
}

function formatComparisonHuman(comparison: Comparison): string {
  const lines: string[] = [];
  for (const file of comparison.files) {
    const rename = file.oldPath ? ` (was ${file.oldPath})` : "";
    lines.push(`${file.status}\t${file.path}${rename}`);
  }
  lines.push(`\n${comparison.totalAdditions} additions, ${comparison.totalDeletions} deletions\n`);
  lines.push(comparison.rawDiff);
  return lines.join("\n");
}

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

async function runList(): Promise<number> {
  const { toplevel } = await detectRepo(process.cwd());
  const checkpoints = await listCheckpoints(toplevel);
  for (const checkpoint of checkpoints) {
    process.stdout.write(`${checkpoint.id}\t${checkpoint.createdAt}\t${checkpoint.name}\n`);
  }
  return 0;
}

async function runCompare(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      json: { type: "boolean" },
      "ignore-whitespace": { type: "boolean" },
    },
    allowPositionals: true,
  });

  const [fromRef, toRef] = positionals;
  if (!fromRef || !toRef) {
    process.stderr.write("Usage: diffcheck compare <from> <to> [--json] [--ignore-whitespace]\n");
    return 1;
  }

  const { toplevel, hasHead } = await detectRepo(process.cwd());
  const checkpoints = await listCheckpoints(toplevel);
  const from = resolveCheckpointRef(checkpoints, fromRef);

  let comparison: Comparison;
  if (toRef === "working") {
    comparison = await compareAgainstWorking(toplevel, hasHead, from);
  } else {
    const to = resolveCheckpointRef(checkpoints, toRef);
    const raw = await diffCommits(toplevel, from.commitSha, to.commitSha);
    comparison = buildComparison(from, to, raw);
  }

  if (values.json) {
    process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatComparisonHuman(comparison)}\n`);
  }
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  switch (command) {
    case "checkpoint":
      return runCheckpoint(rest);
    case "list":
      return runList();
    case "compare":
      return runCompare(rest);
    case undefined:
    case "--help":
    case "-h":
      process.stdout.write(
        "Usage: diffcheck <command> [options]\n\nCommands:\n  checkpoint <name> [--note <text>]\n  list\n  compare <from> <to> [--json] [--ignore-whitespace]\n",
      );
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
