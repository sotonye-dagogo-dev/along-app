import { render, screen, fireEvent } from "@testing-library/react";
import { AppDropdown } from "@/app/components/ui/AppDropdown";
import { AppTableRowActions } from "@/app/components/ui/AppTableRowActions";

describe("AppDropdown trigger toggle (actions-cell regression)", () => {
  it("opens when a nested trigger child calls stopPropagation (Sprint 44 bug)", () => {
    render(
      <AppDropdown
        ariaLabel="Row actions"
        items={[{ label: "View", onClick: () => {} }]}
        trigger={
          <button type="button" onClick={(e) => e.stopPropagation()}>
            Trigger
          </button>
        }
      />
    );
    expect(screen.queryByText("View")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Trigger"));
    expect(screen.getByText("View")).toBeInTheDocument();
  });

  it("toggles closed on a second trigger click", () => {
    render(
      <AppDropdown
        ariaLabel="Row actions"
        items={[{ label: "View", onClick: () => {} }]}
        trigger={<span>Trigger</span>}
      />
    );
    fireEvent.click(screen.getByText("Trigger"));
    expect(screen.getByText("View")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Trigger"));
    expect(screen.queryByText("View")).not.toBeInTheDocument();
  });
});

describe("AppTableRowActions trigger", () => {
  it("opens the row-actions menu on trigger click", () => {
    render(
      <AppTableRowActions
        ariaLabel="Actions for ada"
        actions={[{ id: "view", label: "View", onSelect: () => {} }]}
      />
    );
    expect(screen.queryByText("View")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actions for ada" }));
    expect(screen.getByText("View")).toBeInTheDocument();
  });
});
