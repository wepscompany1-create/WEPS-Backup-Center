import { spawn } from "node:child_process";
import { AppError, ErrorCodes, sanitizeErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { envWithPostgresPath } from "@/lib/postgres/bin-path";

export type PgCommand = "pg_dump" | "pg_restore" | "psql" | "pg_isready";

export type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

const MAX_CAPTURE_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

export class PostgresCommandRunner {
  async run(options: {
    command: PgCommand;
    args: string[];
    env?: Record<string, string>;
    timeoutMs?: number;
    cwd?: string;
  }): Promise<CommandResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const env = envWithPostgresPath({
      ...process.env,
      ...options.env,
      PGCONNECT_TIMEOUT: options.env?.PGCONNECT_TIMEOUT || "15",
    });

    logger.info(
      { command: options.command, args: redactArgs(options.args) },
      "Running PostgreSQL command",
    );

    return new Promise((resolve, reject) => {
      const child = spawn(options.command, options.args, {
        shell: false,
        env,
        cwd: options.cwd,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
        }, 5000).unref();
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes <= MAX_CAPTURE_BYTES) {
          stdout += chunk.toString("utf8");
        }
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes <= MAX_CAPTURE_BYTES) {
          stderr += chunk.toString("utf8");
        }
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          reject(
            new AppError({
              code: ErrorCodes.PG_TOOLS_MISSING,
              message: `${options.command} was not found on PATH`,
              cause: error,
            }),
          );
          return;
        }
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        const result = {
          code: code ?? 1,
          stdout,
          stderr: sanitizeErrorMessage(stderr),
        };
        if (timedOut) {
          reject(
            new AppError({
              code: commandErrorCode(options.command),
              message: `${options.command} timed out after ${timeoutMs}ms`,
            }),
          );
          return;
        }
        resolve(result);
      });
    });
  }

  async assertAvailable() {
    const tools: PgCommand[] = ["pg_dump", "pg_restore", "psql"];
    const versions: Record<string, string> = {};
    for (const tool of tools) {
      const result = await this.run({
        command: tool,
        args: ["--version"],
        timeoutMs: 10_000,
      });
      if (result.code !== 0) {
        throw new AppError({
          code: ErrorCodes.PG_TOOLS_MISSING,
          message: `${tool} --version failed`,
        });
      }
      versions[tool] = result.stdout.trim().split("\n")[0] || "unknown";
    }
    return versions;
  }
}

export const postgresCommandRunner = new PostgresCommandRunner();

function commandErrorCode(command: PgCommand) {
  if (command === "pg_dump") return ErrorCodes.PG_DUMP_FAILED;
  if (command === "pg_restore") return ErrorCodes.PG_RESTORE_FAILED;
  return ErrorCodes.INTERNAL_ERROR;
}

function redactArgs(args: string[]) {
  return args.map((arg) => {
    if (arg.startsWith("postgres://") || arg.startsWith("postgresql://")) {
      return "[redacted-url]";
    }
    return arg;
  });
}
