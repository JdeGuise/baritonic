import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChordEditor } from "../src/components/ChordEditor.tsx";

const props = () => ({
  symbol: "Am",
  targetKey: "C",
  writtenKey: "E",
  inversion: null as number | null,
  hasOverride: false,
  onSave: vi.fn(),
  onRemove: vi.fn(),
  onClose: vi.fn(),
});

describe("ChordEditor", () => {
  it("opens with the current symbol", () => {
    render(<ChordEditor {...props()} />);
    expect(screen.getByLabelText(/chord/i)).toHaveValue("Am");
  });

  it("shows a preview diagram for the current chord", () => {
    const { container } = render(<ChordEditor {...props()} />);
    expect(container.querySelector(".pd")).toBeTruthy();
  });

  it("saves a correction translated into the written key", () => {
    const p = props();
    render(<ChordEditor {...p} />);
    fireEvent.change(screen.getByLabelText(/chord/i), { target: { value: "Am7" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    // Typed in C, stored in E.
    expect(p.onSave).toHaveBeenCalledWith({ correctedSym: "C#m7", inversion: null });
  });

  it("saves nothing for the symbol when it is unchanged", () => {
    const p = props();
    render(<ChordEditor {...p} />);
    fireEvent.change(screen.getByLabelText(/inversion/i), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(p.onSave).toHaveBeenCalledWith({ correctedSym: null, inversion: 1 });
  });

  it("rejects an unreadable symbol in place", () => {
    const p = props();
    render(<ChordEditor {...p} />);
    fireEvent.change(screen.getByLabelText(/chord/i), { target: { value: "H7" } });
    expect(screen.getByText(/not a chord/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it("clears the error once the symbol becomes valid again", () => {
    render(<ChordEditor {...props()} />);
    const input = screen.getByLabelText(/chord/i);
    fireEvent.change(input, { target: { value: "H7" } });
    expect(screen.getByText(/not a chord/i)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Am7" } });
    expect(screen.queryByText(/not a chord/i)).toBeNull();
  });

  it("offers one inversion per chord tone", () => {
    render(<ChordEditor {...props()} />);
    const select = screen.getByLabelText(/inversion/i) as HTMLSelectElement;
    // Am is a triad: automatic, root, 1st, 2nd
    expect(select.options).toHaveLength(4);
  });

  it("offers more inversions for a seventh", () => {
    render(<ChordEditor {...props()} symbol="Am7" />);
    const select = screen.getByLabelText(/inversion/i) as HTMLSelectElement;
    expect(select.options).toHaveLength(5);
  });

  it("updates the preview when the inversion changes", () => {
    const { container } = render(<ChordEditor {...props()} />);
    const before = container.querySelector(".pd svg")?.innerHTML;
    fireEvent.change(screen.getByLabelText(/inversion/i), { target: { value: "2" } });
    expect(container.querySelector(".pd svg")?.innerHTML).not.toBe(before);
  });

  it("offers removal only when an override exists", () => {
    const { rerender } = render(<ChordEditor {...props()} />);
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
    rerender(<ChordEditor {...props()} hasOverride />);
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });

  it("removes the override", () => {
    const p = { ...props(), hasOverride: true };
    render(<ChordEditor {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(p.onRemove).toHaveBeenCalled();
  });

  it("closes on cancel", () => {
    const p = props();
    render(<ChordEditor {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const p = props();
    render(<ChordEditor {...p} />);
    fireEvent.keyDown(screen.getByLabelText(/chord/i), { key: "Escape" });
    expect(p.onClose).toHaveBeenCalled();
  });

  it("saves on Enter", () => {
    const p = props();
    render(<ChordEditor {...p} />);
    fireEvent.change(screen.getByLabelText(/chord/i), { target: { value: "Am7" } });
    fireEvent.keyDown(screen.getByLabelText(/chord/i), { key: "Enter" });
    expect(p.onSave).toHaveBeenCalled();
  });
});
