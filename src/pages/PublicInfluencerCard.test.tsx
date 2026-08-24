import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicInfluencerCard from "./PublicInfluencerCard";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PublicInfluencerCard", () => {
  it("loads influencer data without conditional hooks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              id: "inf-1",
              name: "Maria Creator",
              bio: "Conteudo de moda e beleza.",
              category: "Moda",
              public_username: "maria",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    render(
      <MemoryRouter initialEntries={["/p/maria"]}>
        <Routes>
          <Route path="/p/:username" element={<PublicInfluencerCard />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Maria Creator" })).toBeInTheDocument());
    expect(document.title).toContain("Maria Creator");
  });
});
