import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveAuthTrustedOrigins } from "../auth/better-auth.js";
import { loadConfig } from "../config.js";
import { parseRoutineWebhookPublicBaseUrl } from "../webhook-public-url.js";
import { routineWebhookUrl } from "../services/routines.js";

const missingConfigPath = path.join(
  os.tmpdir(),
  `paperclip-routine-webhook-url-${process.pid}.json`,
);

function useIsolatedConfigEnvironment() {
  vi.stubEnv("PAPERCLIP_CONFIG", missingConfigPath);
  vi.stubEnv("PAPERCLIP_PUBLIC_URL", "");
  vi.stubEnv("PAPERCLIP_AUTH_PUBLIC_BASE_URL", "");
  vi.stubEnv("PAPERCLIP_MANAGED_RUNTIME_PUBLIC_URL", "");
  vi.stubEnv("BETTER_AUTH_URL", "");
  vi.stubEnv("BETTER_AUTH_BASE_URL", "");
  vi.stubEnv("PAPERCLIP_AUTH_BASE_URL_MODE", "");
  vi.stubEnv("PAPERCLIP_ALLOWED_HOSTNAMES", "");
  vi.stubEnv("PAPERCLIP_CHAT_WEBHOOK_PUBLIC_URL", "");
  vi.stubEnv("PAPERCLIP_DEPLOYMENT_MODE", "local_trusted");
  vi.stubEnv("PAPERCLIP_DEPLOYMENT_EXPOSURE", "private");
  vi.stubEnv("PAPERCLIP_BIND", "loopback");
  vi.stubEnv("HOST", "127.0.0.1");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("routine webhook public URL", () => {
  it("accepts only a credential-free HTTPS origin", () => {
    expect(parseRoutineWebhookPublicBaseUrl(undefined)).toBeUndefined();
    expect(parseRoutineWebhookPublicBaseUrl("   ")).toBeUndefined();
    expect(parseRoutineWebhookPublicBaseUrl(" https://hooks.example.test/ ")).toBe(
      "https://hooks.example.test",
    );

    for (const invalid of [
      "http://hooks.example.test",
      "https://user:password@hooks.example.test",
      "https://hooks.example.test/routines",
      "https://hooks.example.test/?token=synthetic-canary",
      "https://hooks.example.test/#synthetic-canary",
      "not a url",
    ]) {
      expect(() => parseRoutineWebhookPublicBaseUrl(invalid)).toThrow(
        "PAPERCLIP_ROUTINE_WEBHOOK_PUBLIC_URL must be an HTTPS origin",
      );
    }
  });

  it("builds routine webhook URLs on the webhook origin instead of the board URL", () => {
    vi.stubEnv("PAPERCLIP_PUBLIC_URL", "http://127.0.0.1:3100");
    vi.stubEnv("PAPERCLIP_API_URL", "http://127.0.0.1:3100");
    vi.stubEnv("PAPERCLIP_ROUTINE_WEBHOOK_PUBLIC_URL", "https://hooks.example.test");

    expect(routineWebhookUrl("abc123")).toBe(
      "https://hooks.example.test/api/routine-triggers/public/abc123/fire",
    );
  });

  it("keeps using the board URL when no webhook origin is set", () => {
    vi.stubEnv("PAPERCLIP_PUBLIC_URL", "http://127.0.0.1:3100");
    vi.stubEnv("PAPERCLIP_ROUTINE_WEBHOOK_PUBLIC_URL", "");

    expect(routineWebhookUrl("abc123")).toBe(
      "http://127.0.0.1:3100/api/routine-triggers/public/abc123/fire",
    );
  });

  it("refuses startup on an invalid value without echoing it", () => {
    const canary = "synthetic-routine-webhook-origin-secret";
    useIsolatedConfigEnvironment();
    vi.stubEnv(
      "PAPERCLIP_ROUTINE_WEBHOOK_PUBLIC_URL",
      `https://user:${canary}@hooks.example.test/private?token=${canary}`,
    );

    let message = "";
    try {
      loadConfig();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("PAPERCLIP_ROUTINE_WEBHOOK_PUBLIC_URL must be an HTTPS origin");
    expect(message).not.toContain(canary);
  });

  it("keeps the webhook origin out of board auth and host trust", () => {
    useIsolatedConfigEnvironment();
    vi.stubEnv("PAPERCLIP_ROUTINE_WEBHOOK_PUBLIC_URL", "https://hooks.example.test/");

    const config = loadConfig();

    expect(config.routineWebhookPublicBaseUrl).toBe("https://hooks.example.test");
    expect(config.authPublicBaseUrl).toBeUndefined();
    expect(config.allowedHostnames).not.toContain("hooks.example.test");
    expect(deriveAuthTrustedOrigins(config)).not.toContain("https://hooks.example.test");
  });
});
