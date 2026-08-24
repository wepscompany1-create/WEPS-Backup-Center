import { describe, expect, it } from "vitest";
import { toPgEnv, parsePostgresUrl } from "@/lib/postgres/url";

describe("command env builder", () => {
  it("maps URL fields to PG* environment variables", () => {
    const env = toPgEnv(parsePostgresUrl("postgres://backup_user:s3cret@db.host:6543/source?sslmode=require"));
    expect(env.PGHOST).toBe("db.host");
    expect(env.PGPORT).toBe("6543");
    expect(env.PGUSER).toBe("backup_user");
    expect(env.PGPASSWORD).toBe("s3cret");
    expect(env.PGDATABASE).toBe("source");
    expect(env.PGSSLMODE).toBe("require");
  });
});
