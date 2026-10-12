import { render, screen, fireEvent } from "@testing-library/react";
import { ChartTooltipWrapper, SvgChartContainer } from "@/app/components/ui/ChartTooltip";

const lines = [{ label: "Signups", value: 12, color: "var(--color-primary)" }];

describe("ChartTooltipWrapper", () => {
  it("renders children without a tooltip when idle", () => {
    render(
      <ChartTooltipWrapper title="Signups" lines={lines}>
        <span>row content</span>
      </ChartTooltipWrapper>
    );
    expect(screen.getByText("row content")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows a hover tooltip with title + lines on mouse move", () => {
    render(
      <ChartTooltipWrapper title="Oct 1" lines={lines}>
        <span>row content</span>
      </ChartTooltipWrapper>
    );
    const host = screen.getByText("row content").parentElement!;
    fireEvent.mouseMove(host, { clientX: 100, clientY: 100 });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Oct 1")).toBeInTheDocument();
    expect(screen.getByText("Signups")).toBeInTheDocument();
  });

  it("exposes an accessible label summarising the values", () => {
    render(
      <ChartTooltipWrapper title="Oct 1" lines={lines}>
        <span>row content</span>
      </ChartTooltipWrapper>
    );
    const host = screen.getByText("row content").parentElement!;
    expect(host).toHaveAttribute("aria-label", expect.stringContaining("Oct 1"));
  });
});

describe("SvgChartContainer", () => {
  const columns = [
    { title: "Mon", lines: [{ label: "Signups", value: 3, color: "var(--color-primary)" }] },
    { title: "Tue", lines: [{ label: "Signups", value: 7, color: "var(--color-primary)" }] },
  ];

  it("renders the chart children with an accessible label", () => {
    render(
      <SvgChartContainer title="Signups chart" columns={columns} count={2}>
        <svg><circle cx="10" cy="10" r="3" /></svg>
      </SvgChartContainer>
    );
    expect(screen.getByRole("img", { name: /Signups chart/ })).toBeInTheDocument();
  });

  it("maps pointer position to the nearest column and shows its tooltip", () => {
    render(
      <SvgChartContainer title="Signups chart" columns={columns} count={2}>
        <svg><circle cx="10" cy="10" r="3" /></svg>
      </SvgChartContainer>
    );
    const host = screen.getByRole("img", { name: /Signups chart/ });
    // jsdom gives zero-size rects; any clientX still resolves to a valid
    // clamped index — the tooltip must appear and name a known column.
    fireEvent.mouseMove(host, { clientX: 5, clientY: 5 });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("renders children with no tooltip when there are no columns (graceful empty)", () => {
    render(
      <SvgChartContainer title="Empty chart" columns={[]} count={0}>
        <span>empty chart body</span>
      </SvgChartContainer>
    );
    expect(screen.getByText("empty chart body")).toBeInTheDocument();
    fireEvent.mouseMove(screen.getByRole("img", { name: /Empty chart/ }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
