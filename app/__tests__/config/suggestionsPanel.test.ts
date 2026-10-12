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
});
