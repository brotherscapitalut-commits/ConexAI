import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocalAuthHeaders, localApiUrl } from "./localApi";
import { localDb } from "./localDbClient";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("local API helpers", () => {
  it("builds local URLs and auth headers", () => {
    localStorage.setItem("local_db_token", "local-token");

    expect(localApiUrl("/api/health")).toMatch(/\/api\/health$/);
    expect(getLocalAuthHeaders()).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer local-token",
    });
  });

  it("bridges local credit checkout to the Express manual endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { ok: true, amount_added: 50 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await localDb.functions.invoke("create-credits-checkout", {
      body: { company_id: "company-1", amount: 50 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/credits/manual-add"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result).toEqual({ data: { ok: true, amount_added: 50 }, error: null });
  });

  it("returns empty subscriptions in local mode", async () => {
    await expect(localDb.functions.invoke("check-subscription")).resolves.toEqual({
      data: { subscriptions: [] },
      error: null,
    });
  });
});
