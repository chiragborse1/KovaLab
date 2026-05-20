import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withTempDir } from "../test-helpers/temp-dir.js";
import {
  DEFAULT_GATEWAY_PORT,
  resolveDefaultConfigCandidates,
  resolveConfigPathCandidate,
  resolveConfigPath,
  resolveGatewayPort,
  resolveGatewayLockDir,
  resolveKovaCompatMode,
  resolveOAuthDir,
  resolveOAuthPath,
  resolveStateDir,
} from "./paths.js";

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides };
}

describe("oauth paths", () => {
  it("prefers KOVA_OAUTH_DIR over legacy OAuth/state env", () => {
    const env = {
      KOVA_OAUTH_DIR: "/custom/kova-oauth",
      KOVA_STATE_DIR: "/custom/state",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.resolve("/custom/kova-oauth"));
    expect(resolveOAuthPath(env, "/custom/state")).toBe(
      path.join(path.resolve("/custom/kova-oauth"), "oauth.json"),
    );
  });

  it("uses KOVA_OAUTH_DIR alongside KOVA_STATE_DIR", () => {
    const env = {
      KOVA_STATE_DIR: "/custom/state",
      KOVA_OAUTH_DIR: "/custom/oauth",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.resolve("/custom/oauth"));
    expect(resolveOAuthPath(env, "/custom/state")).toBe(
      path.join(path.resolve("/custom/oauth"), "oauth.json"),
    );
  });

  it("continues to use KOVA_OAUTH_DIR when compatibility mode is explicit", () => {
    const env = {
      KOVA_COMPAT: "1",
      KOVA_OAUTH_DIR: "/custom/oauth",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.resolve("/custom/oauth"));
  });
});

describe("gateway port resolution", () => {
  it("prefers numeric env values over config", () => {
    expect(
      resolveGatewayPort({ gateway: { port: 19002 } }, envWith({ KOVA_GATEWAY_PORT: "19001" })),
    ).toBe(19001);
  });

  it("prefers KOVA_GATEWAY_PORT over legacy port env and config", () => {
    expect(
      resolveGatewayPort({ gateway: { port: 19003 } }, envWith({ KOVA_GATEWAY_PORT: "19002" })),
    ).toBe(19002);
  });

  it("uses KOVA_GATEWAY_PORT with or without compatibility mode", () => {
    expect(
      resolveGatewayPort({ gateway: { port: 19002 } }, envWith({ KOVA_GATEWAY_PORT: "19001" })),
    ).toBe(19001);
    expect(
      resolveGatewayPort(
        { gateway: { port: 19002 } },
        envWith({ KOVA_COMPAT: "1", KOVA_GATEWAY_PORT: "19001" }),
      ),
    ).toBe(19001);
  });

  it("accepts Compose-style IPv4 host publish values from env", () => {
    expect(
      resolveGatewayPort(
        { gateway: { port: 19002 } },
        envWith({ KOVA_GATEWAY_PORT: "127.0.0.1:18790" }),
      ),
    ).toBe(18790);
  });

  it("accepts Compose-style IPv6 host publish values from env", () => {
    expect(
      resolveGatewayPort(
        { gateway: { port: 19002 } },
        envWith({ KOVA_GATEWAY_PORT: "[::1]:28789" }),
      ),
    ).toBe(28789);
  });

  it("accepts Compose-style values from KOVA_GATEWAY_PORT", () => {
    expect(
      resolveGatewayPort(
        { gateway: { port: 19002 } },
        envWith({ KOVA_GATEWAY_PORT: "127.0.0.1:18789" }),
      ),
    ).toBe(18789);
  });

  it("falls back to config when the Compose-style suffix is invalid", () => {
    expect(
      resolveGatewayPort(
        { gateway: { port: 19003 } },
        envWith({ KOVA_GATEWAY_PORT: "127.0.0.1:not-a-port" }),
      ),
    ).toBe(19003);
  });

  it("falls back when malformed IPv6 inputs do not provide an explicit port", () => {
    expect(
      resolveGatewayPort({ gateway: { port: 19003 } }, envWith({ KOVA_GATEWAY_PORT: "::1" })),
    ).toBe(19003);
    expect(resolveGatewayPort({}, envWith({ KOVA_GATEWAY_PORT: "2001:db8::1" }))).toBe(
      DEFAULT_GATEWAY_PORT,
    );
  });

  it("falls back to the default port when env is invalid and config is unset", () => {
    expect(resolveGatewayPort({}, envWith({ KOVA_GATEWAY_PORT: "127.0.0.1:not-a-port" }))).toBe(
      DEFAULT_GATEWAY_PORT,
    );
  });

  it("defaults fresh Kova gateways to the Kova port", () => {
    expect(DEFAULT_GATEWAY_PORT).toBe(18790);
    expect(resolveGatewayPort({}, envWith({}))).toBe(18790);
  });
});

describe("state + config path candidates", () => {
  function expectKovaHomeDefaults(env: NodeJS.ProcessEnv): void {
    const configuredHome = env.KOVA_HOME;
    if (!configuredHome) {
      throw new Error("KOVA_HOME must be set for this assertion helper");
    }
    const resolvedHome = path.resolve(configuredHome);
    expect(resolveStateDir(env)).toBe(path.join(resolvedHome, ".kova"));

    const candidates = resolveDefaultConfigCandidates(env);
    expect(candidates[0]).toBe(path.join(resolvedHome, ".kova", "kova.json"));
  }

  it("prefers KOVA_STATE_DIR when set", () => {
    const env = {
      KOVA_STATE_DIR: "/new/kova-state",
    } as NodeJS.ProcessEnv;

    expect(resolveStateDir(env, () => "/home/test")).toBe(path.resolve("/new/kova-state"));
  });

  it("uses KOVA_HOME for default state/config locations", () => {
    const env = {
      KOVA_HOME: "/srv/kova-home",
    } as NodeJS.ProcessEnv;
    expectKovaHomeDefaults(env);
  });

  it("prefers KOVA_HOME over KOVA_HOME and HOME for default state/config locations", () => {
    const env = {
      KOVA_HOME: "/srv/kova-home",
      HOME: "/home/other",
    } as NodeJS.ProcessEnv;
    expectKovaHomeDefaults(env);
  });

  it("orders default config candidates in a stable Kova-only order", () => {
    const home = "/home/test";
    const resolvedHome = path.resolve(home);
    const candidates = resolveDefaultConfigCandidates({} as NodeJS.ProcessEnv, () => home);
    const expected = [path.join(resolvedHome, ".kova", "kova.json")];
    expect(candidates).toEqual(expected);
  });

  it("includes legacy config candidates only in explicit compatibility mode", () => {
    const home = "/home/test";
    const resolvedHome = path.resolve(home);
    const candidates = resolveDefaultConfigCandidates(
      { KOVA_COMPAT: "1" } as NodeJS.ProcessEnv,
      () => home,
    );
    expect(candidates).toContain(path.join(resolvedHome, ".kova", "kova.json"));
    expect(candidates).toContain(path.join(resolvedHome, ".kova", "kova.json"));
  });

  it("prefers ~/.kova when it exists and legacy dirs are missing", async () => {
    await withTempDir({ prefix: "kova-state-" }, async (root) => {
      const newDir = path.join(root, ".kova");
      await fs.mkdir(newDir, { recursive: true });
      const resolved = resolveStateDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("does not fall back to existing legacy state dir by default", async () => {
    await withTempDir({ prefix: "kova-state-legacy-" }, async (root) => {
      const legacyDir = path.join(root, ".kova");
      await fs.mkdir(legacyDir, { recursive: true });
      const resolved = resolveStateDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(path.join(root, ".kova"));
    });
  });

  it("falls back to existing legacy state dir only in explicit compatibility mode", async () => {
    await withTempDir({ prefix: "kova-state-legacy-" }, async (root) => {
      const legacyDir = path.join(root, ".kova");
      await fs.mkdir(legacyDir, { recursive: true });
      const resolved = resolveStateDir({ KOVA_COMPAT: "1" } as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(legacyDir);
    });
  });

  it("CONFIG_PATH prefers existing config when present", async () => {
    await withTempDir({ prefix: "kova-config-" }, async (root) => {
      const configDir = path.join(root, ".kova");
      await fs.mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, "kova.json");
      await fs.writeFile(configPath, "{}", "utf-8");

      const resolved = resolveConfigPathCandidate({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(configPath);
    });
  });

  it("respects state dir overrides when config is missing", async () => {
    await withTempDir({ prefix: "kova-config-override-" }, async (root) => {
      const legacyDir = path.join(root, ".kova");
      await fs.mkdir(legacyDir, { recursive: true });
      const legacyConfig = path.join(legacyDir, "kova.json");
      await fs.writeFile(legacyConfig, "{}", "utf-8");

      const overrideDir = path.join(root, "override");
      const env = { KOVA_STATE_DIR: overrideDir } as NodeJS.ProcessEnv;
      const resolved = resolveConfigPath(env, overrideDir, () => root);
      expect(resolved).toBe(path.join(overrideDir, "kova.json"));
    });
  });
});

describe("Kova compatibility mode", () => {
  it("is opt-in", () => {
    expect(resolveKovaCompatMode({} as NodeJS.ProcessEnv)).toBe(false);
    expect(resolveKovaCompatMode({ KOVA_COMPAT: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(resolveKovaCompatMode({ KOVA_COMPAT: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("gateway lock path", () => {
  it("uses a Kova-specific lock namespace", () => {
    expect(path.basename(resolveGatewayLockDir(() => "/tmp"))).toMatch(/^kova(?:-\d+)?$/);
  });
});
