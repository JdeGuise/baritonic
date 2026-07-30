import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LibraryPage } from "../src/pages/LibraryPage.tsx";
import { api, ApiError } from "../src/api/client.ts";
import type { SongSummary } from "../src/api/types.ts";

const show = () =>
  render(
    <MemoryRouter>
      <LibraryPage />
    </MemoryRouter>,
  );

afterEach(() => vi.restoreAllMocks());

const song = (over: Partial<SongSummary> = {}): SongSummary => ({
  id: 1,
  artist: "Demo Artist",
  title: "Placeholder Song",
  effectiveKey: "E",
  detectedKeyConfidence: 0.9,
  preferredKey: "C",
  updatedAt: "2026-07-30T00:00:00.000Z",
  ...over,
});

describe("LibraryPage", () => {
  it("shows a loading state first", () => {
    vi.spyOn(api, "listSongs").mockReturnValue(new Promise(() => {}));
    show();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("lists songs with both keys", async () => {
    vi.spyOn(api, "listSongs").mockResolvedValue([song()]);
    show();
    expect(await screen.findByText("Placeholder Song")).toBeInTheDocument();
    expect(screen.getByText("Demo Artist")).toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("links each row to the song", async () => {
    vi.spyOn(api, "listSongs").mockResolvedValue([song()]);
    show();
    const link = await screen.findByRole("link", { name: /Placeholder Song/ });
    expect(link).toHaveAttribute("href", "/songs/1");
  });

  it("flags a low-confidence key", async () => {
    vi.spyOn(api, "listSongs").mockResolvedValue([song({ detectedKeyConfidence: 0.4 })]);
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(container.querySelector(".chip.low")).toBeTruthy();
  });

  it("does not flag a confident key", async () => {
    vi.spyOn(api, "listSongs").mockResolvedValue([song()]);
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(container.querySelector(".chip.low")).toBeNull();
  });

  it("shows an empty state with a call to action", async () => {
    vi.spyOn(api, "listSongs").mockResolvedValue([]);
    show();
    expect(await screen.findByText(/no songs yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /import/i })).toBeInTheDocument();
  });

  it("shows an error when the request fails", async () => {
    vi.spyOn(api, "listSongs").mockRejectedValue(new ApiError(500, "Server exploded"));
    show();
    await waitFor(() => expect(screen.getByText(/Server exploded/)).toBeInTheDocument());
  });

  it("filters by title, artist, or key", async () => {
    vi.spyOn(api, "listSongs").mockResolvedValue([
      song(),
      song({ id: 2, title: "Second", artist: "Other", effectiveKey: "G" }),
    ]);
    show();
    await screen.findByText("Placeholder Song");

    fireEvent.change(screen.getByLabelText(/search songs/i), { target: { value: "Second" } });

    expect(screen.queryByText("Placeholder Song")).toBeNull();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("reports when nothing matches the filter", async () => {
    vi.spyOn(api, "listSongs").mockResolvedValue([song()]);
    show();
    await screen.findByText("Placeholder Song");
    fireEvent.change(screen.getByLabelText(/search songs/i), { target: { value: "zzzz" } });
    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
  });
});
