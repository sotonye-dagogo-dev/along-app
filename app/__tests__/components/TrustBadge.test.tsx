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
});
