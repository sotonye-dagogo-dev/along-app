import fs from "fs";
import path from "path";
import { SUGGESTIONS_PANEL_CONFIG } from "@/app/lib/config/suggestionsPanel";

describe("SUGGESTIONS_PANEL_CONFIG (desktop open-requests scrollable tape)", () => {
  it("switches to carousel only when multiple requests exist", () => {
    expect(SUGGESTIONS_PANEL_CONFIG.openRequests.minForCarousel).toBe(2);
  });

  it("keeps cards narrower than the w-80 rail so the tape overflows + scrolls", () => {
    expect(SUGGESTIONS_PANEL_CONFIG.openRequests.cardWidthClass).toMatch(/w-\[/);
  });

  it("provides an accessible label, duration, hint and fallback height", () => {
    const { openRequests } = SUGGESTIONS_PANEL_CONFIG;
    expect(openRequests.carouselLabel.length).toBeGreaterThan(0);
    expect(openRequests.carouselDurationSec).toBeGreaterThan(0);
    expect(openRequests.scrollHint.length).toBeGreaterThan(0);
    expect(openRequests.listMaxHeightClass).toMatch(/max-h-/);
  });

  it("caps the sticky desktop rail to the viewport and owns its scroll", () => {
    const { panel } = SUGGESTIONS_PANEL_CONFIG;
    expect(panel.maxHeightClass).toMatch(/max-h-\[calc\(100vh-2rem\)\]/);
    expect(panel.overflowClass).toMatch(/overflow-y-auto/);
    expect(panel.scrollbarClass).toContain("scroll-thin");
    expect(panel.overscrollClass).toContain("overscroll-contain");
  });

  it("wires the panel classes into the rendered desktop aside", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/components/ui/SuggestionsPanel.tsx"),
      "utf8",
    );
    expect(source).toContain("SUGGESTIONS_PANEL_CONFIG.panel.maxHeightClass");
    expect(source).toContain("SUGGESTIONS_PANEL_CONFIG.panel.overflowClass");
    expect(source).toContain("SUGGESTIONS_PANEL_CONFIG.panel.scrollbarClass");
    expect(source).toContain("SUGGESTIONS_PANEL_CONFIG.panel.overscrollClass");
    expect(source).toContain("className={SUGGESTIONS_PANEL_CLASS}");
    // Both the loading skeleton and the real panel share the scroll cap.
    expect(source.match(/aria-label="Suggestions"/g)?.length).toBe(2);
  });
});
