import { beforeAll, describe, expect, it } from "vitest";
import { discord } from "../../../src/adapters/discord";
import { createEnv } from "../../helpers";

const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

const baseEnv = createEnv({ DISCORD_APP_ID: "app1", DISCORD_PUBLIC_KEY: "00" });

describe("verify", () => {
  const body = '{"type":1}';
  const timestamp = "1793923200";
  let env = baseEnv;
  let signature = "";

  beforeAll(async () => {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const publicKey = (await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer;
    env = { ...baseEnv, DISCORD_PUBLIC_KEY: toHex(publicKey) };
    signature = toHex(
      await crypto.subtle.sign(
        { name: "Ed25519" },
        pair.privateKey,
        new TextEncoder().encode(timestamp + body),
      ),
    );
  });

  const headers = (sig = signature, ts = timestamp) =>
    new Headers({ "X-Signature-Ed25519": sig, "X-Signature-Timestamp": ts });

  it("accepts a real signature in the Workers runtime", async () => {
    expect(await discord.verify(body, headers(), env)).toBe(true);
  });

  it("rejects a changed body or timestamp", async () => {
    expect(await discord.verify(`${body} `, headers(), env)).toBe(false);
    expect(await discord.verify(body, headers(signature, "1"), env)).toBe(false);
  });

  it("fails closed on missing or malformed input", async () => {
    expect(await discord.verify(body, new Headers(), env)).toBe(false);
    expect(await discord.verify(body, headers("not-hex"), env)).toBe(false);
    expect(await discord.verify(body, headers(), { ...env, DISCORD_PUBLIC_KEY: undefined })).toBe(false);
  });
});
