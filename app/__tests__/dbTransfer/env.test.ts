/**
 * `.env` loading tests.
 *
 * These scripts are plain `tsx` processes, so nothing loads `.env` for
 * them. Getting this wrong makes a correctly-configured repo look like it
 * has no connection URLs at all, which is a uniquely misleading failure.
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ENV_FILES,
  describeLoadedEnv,
  loadEnvFiles,
  type EnvLike,
} from "@/scripts/lib/dbTransfer/env";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dbtransfer-env-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(name: string, contents: string): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), contents, "utf8");
}

describe("ENV_FILES precedence", () => {
  it("mirrors Next.js: .env.local beats .env", () => {
    expect(ENV_FILES[0]).toBe(".env.local");
    expect(ENV_FILES).toContain(".env");
    // `.env.local` must be consulted BEFORE `.env`.
    expect(ENV_FILES.indexOf(".env.local")).toBeLessThan(ENV_FILES.indexOf(".env"));
  });
});

describe("loadEnvFiles", () => {
  it("returns nothing when no .env files exist", () => {
    const env: EnvLike = {};
    expect(loadEnvFiles({ cwd: root, env })).toEqual([]);
    expect(env).toEqual({});
  });

  it("loads keys from .env", () => {
    write(".env", "DIRECT_URL=postgresql://host:5432/postgres\nSHARED=from-dotenv\n");
    const env: EnvLike = {};

    const loaded = loadEnvFiles({ cwd: root, env });

    expect(env.DIRECT_URL).toBe("postgresql://host:5432/postgres");
    expect(env.SHARED).toBe("from-dotenv");
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ file: ".env", declaredKeys: 2, appliedKeys: 2 });
  });

  it("NEVER overrides an already-exported shell variable", () => {
    write(".env", "DIRECT_URL=postgresql://from-file:5432/postgres\n");
    const env: EnvLike = { DIRECT_URL: "postgresql://from-shell:5432/postgres" };

    loadEnvFiles({ cwd: root, env });

    // An operator pointing a one-off run at another host must win.
    expect(env.DIRECT_URL).toBe("postgresql://from-shell:5432/postgres");
  });

  it("reports keys it declined to apply", () => {
    write(".env", "A=1\nB=2\n");
    const env: EnvLike = { A: "already-set" };

    const [entry] = loadEnvFiles({ cwd: root, env });

    expect(entry.declaredKeys).toBe(2);
    expect(entry.appliedKeys).toBe(1);
    expect(env.A).toBe("already-set");
    expect(env.B).toBe("2");
  });

  it("lets .env.local win over .env", () => {
    write(".env", "SHARED=from-env\nONLY_IN_ENV=yes\n");
    write(".env.local", "SHARED=from-env-local\n");
    const env: EnvLike = {};

    const loaded = loadEnvFiles({ cwd: root, env });

    expect(env.SHARED).toBe("from-env-local");
    expect(env.ONLY_IN_ENV).toBe("yes");
    expect(loaded.map((f) => f.file)).toEqual([".env.local", ".env"]);
  });

  it("loads a file containing quotes, comments and blank lines", () => {
    write(
      ".env",
      [
        "# a comment",
        "",
        'QUOTED="postgresql://u:p@h:5432/db?sslmode=no-verify"',
        "SINGLE='value'",
        "  SPACED = padded  ",
      ].join("\n"),
    );
    const env: EnvLike = {};

    loadEnvFiles({ cwd: root, env });

    expect(env.QUOTED).toBe("postgresql://u:p@h:5432/db?sslmode=no-verify");
    expect(env.SINGLE).toBe("value");
    expect(env.SPACED).toBe("padded");
  });

  it("survives a malformed line instead of aborting a migration", () => {
    write(".env", "this line has no equals sign\nGOOD=yes\n");
    const env: EnvLike = {};

    expect(() => loadEnvFiles({ cwd: root, env })).not.toThrow();
    expect(env.GOOD).toBe("yes");
  });

  it("consults extra files after the standard ones", () => {
    write(".env", "K=base\n");
    write(".env.production", "K=prod\n");
    const env: EnvLike = {};

    loadEnvFiles({ cwd: root, env, extraFiles: [".env.production"] });

    // Standard files load first, so the extra file cannot shadow .env.local.
    expect(env.K).toBe("base");
  });

  it("does not leak values into the real process.env", () => {
    write(".env", "ISOLATED_SENTINEL=must-not-escape\n");
    const env: EnvLike = {};

    loadEnvFiles({ cwd: root, env });

    expect(env.ISOLATED_SENTINEL).toBe("must-not-escape");
    expect(process.env.ISOLATED_SENTINEL).toBeUndefined();
  });
});

describe("describeLoadedEnv", () => {
  it("renders nothing when no file was loaded", () => {
    expect(describeLoadedEnv([])).toBe("");
  });

  it("names each file with applied/declared counts", () => {
    expect(
      describeLoadedEnv([
        { file: ".env", declaredKeys: 48, appliedKeys: 48 },
        { file: ".env.local", declaredKeys: 3, appliedKeys: 1 },
      ]),
    ).toBe("env: .env (48/48 keys applied), .env.local (1/3 keys applied)");
  });
});
