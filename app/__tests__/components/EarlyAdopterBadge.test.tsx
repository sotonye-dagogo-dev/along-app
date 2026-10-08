import { render, screen } from "@testing-library/react";
import {
  EarlyAdopterBadge,
  EarlyAdopterBadgeFromStatus,
} from "@/app/components/features/profile/EarlyAdopterBadge";

describe("EarlyAdopterBadge", () => {
  it("renders the label text", () => {
    render(<EarlyAdopterBadge rank={42} limit={100} label="First 100 Users #42" />);
    expect(screen.getByText("First 100 Users #42")).toBeInTheDocument();
  });

  it("exposes an accessible tooltip label", () => {
    render(<EarlyAdopterBadge rank={7} limit={100} label="First 100 Users #7" />);
    expect(screen.getByLabelText(/first 100.*#7/i)).toBeInTheDocument();
  });

  it("renders from API status payload when qualified", () => {
    render(
      <EarlyAdopterBadgeFromStatus
        earlyAdopter={{ enabled: true, limit: 100, rank: 3, isEarlyAdopter: true, label: "First 100 Users #3" }}
      />
    );
    expect(screen.getByText("First 100 Users #3")).toBeInTheDocument();
  });

  it("renders nothing when disabled", () => {
    const { container } = render(
      <EarlyAdopterBadgeFromStatus
        earlyAdopter={{ enabled: false, limit: 100, rank: 3, isEarlyAdopter: false, label: null }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when not qualified", () => {
    const { container } = render(
      <EarlyAdopterBadgeFromStatus
        earlyAdopter={{ enabled: true, limit: 100, rank: 500, isEarlyAdopter: false, label: null }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for null payload", () => {
    const { container } = render(<EarlyAdopterBadgeFromStatus earlyAdopter={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
