import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { envWithPostgresPath } from "@/lib/postgres/bin-path";

describe("postgres bin path", () => {
  it("prepends POSTGRES_BIN_DIR to PATH when the directory exists", () => {
    const bin = tmpdir();
    const env = envWithPostgresPath({
      NODE_ENV: "test",
      POSTGRES_BIN_DIR: bin,
      PATH: "/usr/bin",
    });
    expect(env.PATH?.startsWith(bin)).toBe(true);
  });
});
