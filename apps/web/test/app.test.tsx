import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App.tsx";
import { api } from "../src/api/client.ts";

// The "/" route mounts LibraryPage, which loads on mount. Stub it so this
// suite tests the shell rather than trailing an unresolved fetch past the
// end of the test.
beforeEach(() => {
  vi.spyOn(api, "listSongs").mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("App shell", () => {
  it("renders the brand and an import action", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    // findBy* lets the LibraryPage load settle inside act before asserting.
    expect(await screen.findByRole("link", { name: /music-ui/i })).toBeInTheDocument();
    // Exact name: the empty library also renders "Import your first song".
    expect(screen.getByRole("link", { name: "Import" })).toBeInTheDocument();
    expect(await screen.findByText(/no songs yet/i)).toBeInTheDocument();
  });
});
