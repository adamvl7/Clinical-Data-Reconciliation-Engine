import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { checkApiKey } from "@/lib/auth";

describe("API Key Authentication", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects requests with missing API key when secret is set", () => {
    process.env.API_SECRET_KEY = "test-secret-123";
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: {},
    });
    const result = checkApiKey(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it("rejects requests with wrong API key", () => {
    process.env.API_SECRET_KEY = "test-secret-123";
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "x-api-key": "wrong-key" },
    });
    const result = checkApiKey(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it("allows requests with correct API key", () => {
    process.env.API_SECRET_KEY = "test-secret-123";
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "x-api-key": "test-secret-123" },
    });
    const result = checkApiKey(req);
    expect(result).toBeNull();
  });

  it("allows all requests when no API_SECRET_KEY is set", () => {
    delete process.env.API_SECRET_KEY;
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
    });
    const result = checkApiKey(req);
    expect(result).toBeNull();
  });
});
