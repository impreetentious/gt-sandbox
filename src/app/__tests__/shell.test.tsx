import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import packageMetadata from "../../../package.json";
import RootLayout from "../layout";
import HomePage from "../page";

describe("application shell and launch home", () => {
  it("exposes the primary routes and the package version", () => {
    const shell = renderToStaticMarkup(
      <RootLayout>
        <HomePage />
      </RootLayout>,
    );

    expect(shell).toContain('aria-label="Primary"');
    expect(shell).toContain(`v${packageMetadata.version}`);

    render(<HomePage />);
    expect(
      screen.getByRole("link", { name: "Start with the price war" }),
    ).toHaveAttribute("href", "/play/pd");
    expect(screen.getAllByRole("article")).toHaveLength(16);
  });
});
