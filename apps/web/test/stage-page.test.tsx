import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StagePage } from "../src/pages/StagePage.tsx";
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
  tuning: null,
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
  overrides: [],
  inversions: [],
  orphanedOverrides: [],
  importedAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
  ...over,
});

const show = () =>
  render(
    <MemoryRouter initialEntries={["/songs/1/stage"]}>
      <Routes>
        <Route path="/songs/:id/stage" element={<StagePage />} />
        <Route path="/songs/:id" element={<p>song page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const chords = (container: HTMLElement) =>
  [...container.querySelectorAll(".unit-chord")].map((n) => n.textContent);

afterEach(() => vi.restoreAllMocks());

describe("StagePage", () => {
  it("shows the chart in the preferred key", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail({ preferredKey: "C" }));
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(chords(container)).toEqual(["C", "Am"]);
  });

  it("falls back to the written key", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(chords(container)).toEqual(["E", "C#m"]);
  });

  it("does not make chords editable", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(container.querySelectorAll("button.unit-chord")).toHaveLength(0);
  });

  it("starts paused", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("toggles between play and pause", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("offers a scroll speed control", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    const speed = screen.getByLabelText(/scroll speed/i);
    fireEvent.change(speed, { target: { value: "5" } });
    expect(speed).toHaveValue("5");
  });

  it("offers a type size control", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");

    const before = container.querySelector(".stage")?.getAttribute("style");
    fireEvent.click(screen.getByRole("button", { name: /larger/i }));
    expect(container.querySelector(".stage")?.getAttribute("style")).not.toBe(before);
  });

  it("dims the controls while scrolling", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");

    expect(container.querySelector(".stage-bar.dim")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(container.querySelector(".stage-bar.dim")).toBeTruthy();
  });

  it("leaves on Escape", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByText("song page")).toBeInTheDocument();
  });

  it("has an exit control", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    fireEvent.click(screen.getByRole("button", { name: /exit/i }));
    expect(await screen.findByText("song page")).toBeInTheDocument();
  });

  it("toggles play with the space bar", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("shows an error when the song cannot be loaded", async () => {
    vi.spyOn(api, "getSong").mockRejectedValue(new ApiError(404, "Song not found"));
    show();
    expect(await screen.findByText(/Song not found/)).toBeInTheDocument();
  });
});
