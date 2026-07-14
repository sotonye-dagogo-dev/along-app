import { render, screen } from "@testing-library/react";
import { AppEmptyState } from "@/app/components/ui/AppEmptyState";

describe("AppEmptyState", () => {
  it("renders preset content when preset prop is provided", () => {
    render(<AppEmptyState preset="feed" />);
    expect(screen.getByText("No posts yet")).toBeInTheDocument();
    expect(screen.getByText("Explore Routes")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/explore");
  });

  it("renders custom content when props are provided", () => {
    render(
      <AppEmptyState
        icon={undefined}
        title="Custom Title"
        description="Custom description"
        actionLabel="Go Home"
        actionHref="/home"
      />
    );
    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Custom description")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/home");
  });

  it("renders feed preset with correct icon", () => {
    const { container } = render(<AppEmptyState preset="feed" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders bookmarks preset", () => {
    render(<AppEmptyState preset="bookmarks" />);
    expect(screen.getByText("No bookmarks yet")).toBeInTheDocument();
    expect(screen.getByText("Discover Routes")).toBeInTheDocument();
  });

  it("renders notifications preset without action link", () => {
    render(<AppEmptyState preset="notifications" />);
    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders search preset", () => {
    render(<AppEmptyState preset="search" />);
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("renders offline preset", () => {
    render(<AppEmptyState preset="offline" />);
    expect(screen.getByText("You are offline")).toBeInTheDocument();
  });

  it("renders error preset", () => {
    render(<AppEmptyState preset="error" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders comments preset", () => {
    render(<AppEmptyState preset="comments" />);
    expect(screen.getByText("No comments yet")).toBeInTheDocument();
  });

  it("renders likes preset", () => {
    render(<AppEmptyState preset="likes" />);
    expect(screen.getByText("No likes yet")).toBeInTheDocument();
  });

  it("followers preset with description", () => {
    render(<AppEmptyState preset="followers" />);
    expect(screen.getByText("No followers yet")).toBeInTheDocument();
  });

  it("renders routes preset with share action", () => {
    render(<AppEmptyState preset="routes" />);
    expect(screen.getByText("No routes shared yet")).toBeInTheDocument();
    expect(screen.getByText("Share a Route")).toBeInTheDocument();
  });

  it("renders reviews preset", () => {
    render(<AppEmptyState preset="reviews" />);
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });

  it("renders messages preset", () => {
    render(<AppEmptyState preset="messages" />);
    expect(screen.getByText("No messages")).toBeInTheDocument();
  });

  it("renders empty state when no preset or content provided", () => {
    const { container } = render(<AppEmptyState />);
    const div = container.querySelector(".flex");
    expect(div).toBeInTheDocument();
  });

  it("applies sm variant classes", () => {
    const { container } = render(<AppEmptyState preset="feed" variant="sm" />);
    const outer = container.querySelector(".min-h-\\[160px\\]");
    expect(outer).toBeInTheDocument();
  });

  it("applies lg variant classes", () => {
    const { container } = render(<AppEmptyState preset="feed" variant="lg" />);
    const outer = container.querySelector(".min-h-\\[360px\\]");
    expect(outer).toBeInTheDocument();
  });
});
