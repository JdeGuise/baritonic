import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App.tsx";

describe("App shell", () => {
  it("renders the brand and an import action", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /music-ui/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /import/i })).toBeInTheDocument();
  });
});
