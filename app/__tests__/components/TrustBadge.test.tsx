import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrustBadge } from "@/app/components/ui/TrustBadge";

describe("TrustBadge", () => {
  it("renders low trust level", () => {
    render(<TrustBadge level="low" score={15} />);
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("renders developing trust level", () => {
    render(<TrustBadge level="developing" score={45} />);
    expect(screen.getByText("Developing")).toBeInTheDocument();
  });

  it("renders verified trust level", () => {
    render(<TrustBadge level="verified" score={70} />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("renders trusted trust level", () => {
    render(<TrustBadge level="trusted" score={95} />);
    expect(screen.getByText("Trusted")).toBeInTheDocument();
  });

  it("shows tooltip on hover when showTooltip is true", async () => {
    const user = userEvent.setup();
    render(<TrustBadge level="verified" score={72} showTooltip />);

    const badge = screen.getByText("Verified").closest(".relative");
    expect(badge).toBeInTheDocument();

    await act(async () => {
      await user.hover(badge!);
    });

    expect(screen.getByText("Trust Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
  });

  it("does not show tooltip when showTooltip is false", async () => {
    const user = userEvent.setup();
    render(<TrustBadge level="trusted" score={95} showTooltip={false} />);

    const badge = screen.getByText("Trusted").closest(".relative");
    await act(async () => {
      await user.hover(badge!);
    });

    expect(screen.queryByText("Trust Breakdown")).not.toBeInTheDocument();
  });

  it("renders sm size", () => {
    const { container } = render(<TrustBadge level="low" score={10} size="sm" />);
    expect(container.querySelector(".text-xs")).toBeInTheDocument();
  });

  it("renders default size", () => {
    const { container } = render(<TrustBadge level="low" score={10} size="default" />);
    expect(container.querySelector(".text-sm")).toBeInTheDocument();
  });

  it("shows live breakdown values when provided", async () => {
    const user = userEvent.setup();
    render(
      <TrustBadge
        level="verified"
        score={72}
        showTooltip
        breakdown={{ community: 80, detail: 70, corroboration: 60, recency: 90, reputation: 55, engagement: 40 }}
      />
    );

    const badge = screen.getByText("Verified").closest(".relative");
    await act(async () => {
      await user.hover(badge!);
    });

    expect(screen.getByText("Trust Breakdown")).toBeInTheDocument();
    // Live rows render the exact engine values (not score-derived offsets).
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("Reputation")).toBeInTheDocument();
    expect(screen.getByText("Engagement")).toBeInTheDocument();
  });

  it("omits reputation/engagement rows without live values", async () => {
    const user = userEvent.setup();
    render(<TrustBadge level="verified" score={72} showTooltip />);

    const badge = screen.getByText("Verified").closest(".relative");
    await act(async () => {
      await user.hover(badge!);
    });

    expect(screen.queryByText("Reputation")).not.toBeInTheDocument();
    expect(screen.queryByText("Engagement")).not.toBeInTheDocument();
  });

  it("compact variant shows the same shared values as the full view", async () => {
    const user = userEvent.setup();
    const breakdown = { community: 80, detail: 70, corroboration: 60, recency: 90, reputation: 55, engagement: 40, score: 74 };
    const { unmount } = render(
      <TrustBadge level="verified" score={10} showTooltip variant="compact" breakdown={breakdown} />
    );
    const badge = screen.getByText("74").closest(".relative");
    await act(async () => {
      await user.hover(badge!);
    });
    // Shared rows carry the identical engine values (not placeholders).
    expect(screen.getByText("60%")).toBeInTheDocument();
    // Compact omits the extended rows while the badge number follows the live score.
    expect(screen.queryByText("Reputation")).not.toBeInTheDocument();
    expect(screen.queryByText("Engagement")).not.toBeInTheDocument();
    unmount();
  });

  it("prefers the live breakdown score over the stored score prop", () => {
    render(
      <TrustBadge level="low" score={10} showTooltip={false} breakdown={{ community: 80, detail: 70, corroboration: 60, recency: 90, score: 72 }} />
    );
    // 72 re-derives to Verified, so a stale Low label can never stick.
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
  });
});
