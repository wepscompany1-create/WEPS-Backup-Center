import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

export function resolvePostgresBinDir(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.POSTGRES_BIN_DIR?.trim();
  if (configured && existsSync(configured)) {
    return configured;
  }

  if (process.platform !== "win32") {
    return undefined;
  }

  const roots = [env.ProgramFiles, env["ProgramFiles(x86)"]].filter(Boolean) as string[];
  const bins: string[] = [];
  for (const root of roots) {
    const pgRoot = path.join(root, "PostgreSQL");
    if (!existsSync(pgRoot)) continue;
    for (const entry of readdirSync(pgRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const bin = path.join(pgRoot, entry.name, "bin");
      if (existsSync(path.join(bin, "pg_dump.exe"))) {
        bins.push(bin);
      }
    }
  }

  bins.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return bins[0];
}

export function envWithPostgresPath(env: NodeJS.ProcessEnv = process.env) {
  const bin = resolvePostgresBinDir(env);
  if (!bin) return { ...env };
  const delimiter = process.platform === "win32" ? ";" : ":";
  const current = env.PATH || env.Path || "";
  const alreadyPresent = current
    .split(delimiter)
    .some((part) => part.replace(/[/\\]+$/, "").toLowerCase() === bin.toLowerCase());
  if (alreadyPresent) return { ...env };
  return {
    ...env,
    PATH: `${bin}${delimiter}${current}`,
  };
}
