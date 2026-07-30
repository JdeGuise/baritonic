import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ImportPage } from "../src/pages/ImportPage.tsx";
import { api, ApiError } from "../src/api/client.ts";
import type { SongDetail } from "../src/api/types.ts";

const stub = (id: number) => ({ id }) as SongDetail;

const show = () =>
  render(
    <MemoryRouter initialEntries={["/import"]}>
      <Routes>
        <Route path="/import" element={<ImportPage />} />
        <Route path="/songs/:id" element={<p>song page</p>} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => vi.restoreAllMocks());

describe("ImportPage", () => {
  it("offers both a url tab and a paste tab", () => {
    show();
    expect(screen.getByRole("tab", { name: /from url/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /paste/i })).toBeInTheDocument();
  });

  it("imports from a url and navigates to the song", async () => {
    const spy = vi.spyOn(api, "importUrl").mockResolvedValue(stub(7));
    show();
    fireEvent.change(screen.getByLabelText(/url/i), {
      target: { value: "https://tabs.ultimate-guitar.com/tab/demo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => expect(screen.getByText("song page")).toBeInTheDocument());
    expect(spy).toHaveBeenCalledWith("https://tabs.ultimate-guitar.com/tab/demo");
  });

  it("disables import until a url is entered", () => {
    show();
    expect(screen.getByRole("button", { name: /^import$/i })).toBeDisabled();
  });

  it("switches to the paste tab and imports text", async () => {
    const spy = vi.spyOn(api, "importText").mockResolvedValue(stub(9));
    show();
    fireEvent.click(screen.getByRole("tab", { name: /paste/i }));

    fireEvent.change(screen.getByLabelText(/artist/i), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "T" } });
    fireEvent.change(screen.getByLabelText(/tab text/i), {
      target: { value: "[Verse]\n[ch]C[/ch]" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => expect(screen.getByText("song page")).toBeInTheDocument());
    expect(spy).toHaveBeenCalledWith({ artist: "A", title: "T", rawBody: "[Verse]\n[ch]C[/ch]" });
  });

  it("shows the server's message when the import fails", async () => {
    vi.spyOn(api, "importUrl").mockRejectedValue(
      new ApiError(422, "This looks like a Pro tab, which has no readable chord data."),
    );
    show();
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: "https://x.test" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    expect(await screen.findByText(/Pro tab/)).toBeInTheDocument();
  });

  it("suggests pasting when fetching is blocked", async () => {
    vi.spyOn(api, "importUrl").mockRejectedValue(
      new ApiError(
        502,
        "Ultimate Guitar returned a challenge page (HTTP 403). Paste the tab text instead.",
      ),
    );
    show();
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: "https://x.test" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    expect(await screen.findByText(/paste the tab text/i)).toBeInTheDocument();
  });

  it("reports a duplicate import clearly", async () => {
    vi.spyOn(api, "importUrl").mockRejectedValue(
      new ApiError(409, "That tab has already been imported"),
    );
    show();
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: "https://x.test" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    expect(await screen.findByText(/already been imported/i)).toBeInTheDocument();
  });
});
