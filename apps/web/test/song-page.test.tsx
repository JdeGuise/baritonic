import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SongPage } from "../src/pages/SongPage.tsx";
import { api, ApiError } from "../src/api/client.ts";
import type { SongDetail } from "../src/api/types.ts";

const detail = (over: Partial<SongDetail> = {}): SongDetail => ({
  id: 1,
  sourceUrl: null,
  artist: "Demo Artist",
  title: "Placeholder Song",
  tabType: "Chords",
  detectedKey: "E",
  detectedKeyConfidence: 0.9,
  keyOverride: null,
  preferredKey: null,
  tuning: "E A D G B E",
  document: {
    sections: [
      {
        label: "Verse",
        lines: [
          {
            kind: "lyric",
            text: "placeholder words here",
            chords: [
              { sym: "E", at: 0 },
              { sym: "C#m", at: 12 },
            ],
          },
        ],
      },
    ],
  },
  ugMeta: null,
  inversions: [],
  orphanedOverrides: [],
  importedAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
  ...over,
});

const show = () =>
  render(
    <MemoryRouter initialEntries={["/songs/1"]}>
      <Routes>
        <Route path="/songs/:id" element={<SongPage />} />
      </Routes>
    </MemoryRouter>,
  );

const chords = (container: HTMLElement) =>
  [...container.querySelectorAll(".unit-chord")].map((n) => n.textContent);

afterEach(() => vi.restoreAllMocks());

describe("SongPage", () => {
  it("renders the title, artist, and written key", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    expect(await screen.findByText("Placeholder Song")).toBeInTheDocument();
    expect(screen.getByText("Demo Artist")).toBeInTheDocument();
    expect(screen.getByLabelText(/written in/i)).toHaveValue("E");
  });

  it("renders the chart in the written key by default", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(chords(container)).toEqual(["E", "C#m"]);
  });

  it("opens in the preferred key when one is stored", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail({ preferredKey: "C" }));
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(chords(container)).toEqual(["C", "Am"]);
  });

  it("transposes without any network request when the key changes", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const patch = vi.spyOn(api, "updateSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");

    fireEvent.change(screen.getByLabelText(/play in/i), { target: { value: "C" } });

    expect(chords(container)).toEqual(["C", "Am"]);
    expect(patch).not.toHaveBeenCalled();
  });

  it("keeps chords over the same lyric fragments after transposing", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");
    const before = [...container.querySelectorAll(".unit-text")].map((n) => n.textContent);

    fireEvent.change(screen.getByLabelText(/play in/i), { target: { value: "Db" } });

    expect([...container.querySelectorAll(".unit-text")].map((n) => n.textContent)).toEqual(before);
  });

  it("shows the semitone distance", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    fireEvent.change(screen.getByLabelText(/play in/i), { target: { value: "C" } });
    expect(screen.getByText(/-4 semitones/i)).toBeInTheDocument();
  });

  it("saves the preferred key explicitly", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const patch = vi.spyOn(api, "updateSong").mockResolvedValue(detail({ preferredKey: "C" }));
    show();
    await screen.findByText("Placeholder Song");

    fireEvent.change(screen.getByLabelText(/play in/i), { target: { value: "C" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith(1, { preferredKey: "C" }));
  });

  it("corrects the written key through the selector", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const patch = vi.spyOn(api, "updateSong").mockResolvedValue(detail({ keyOverride: "A" }));
    show();
    await screen.findByText("Placeholder Song");

    fireEvent.change(screen.getByLabelText(/written in/i), { target: { value: "A" } });
    await waitFor(() => expect(patch).toHaveBeenCalledWith(1, { keyOverride: "A" }));
  });

  it("renders one piano diagram per distinct chord", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(container.querySelectorAll(".pd")).toHaveLength(2);
  });

  it("recomputes the diagrams when the key changes", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect([...container.querySelectorAll(".pd-name")].map((n) => n.textContent)).toEqual([
      "E",
      "C#m",
    ]);

    fireEvent.change(screen.getByLabelText(/play in/i), { target: { value: "C" } });
    expect([...container.querySelectorAll(".pd-name")].map((n) => n.textContent)).toEqual([
      "C",
      "Am",
    ]);
  });

  it("flags a low-confidence detected key", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail({ detectedKeyConfidence: 0.4 }));
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(container.querySelector(".chip.low")).toBeTruthy();
  });

  it("warns about orphaned overrides", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(
      detail({
        orphanedOverrides: [
          {
            override: {
              sectionIdx: 0,
              lineIdx: 0,
              chordIdx: 0,
              originalSym: "Dm",
              correctedSym: "D7",
              inversion: null,
            },
            reason: "symbol-changed",
            foundSym: "E",
          },
        ],
      }),
    );
    show();
    await screen.findByText("Placeholder Song");
    expect(screen.getByText(/1 saved correction/i)).toBeInTheDocument();
  });

  it("shows an error when the song cannot be loaded", async () => {
    vi.spyOn(api, "getSong").mockRejectedValue(new ApiError(404, "Song not found"));
    show();
    expect(await screen.findByText(/Song not found/)).toBeInTheDocument();
  });
});
