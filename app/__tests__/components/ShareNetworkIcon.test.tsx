import { render } from "@testing-library/react";
import ShareNetworkIcon from "@/app/components/features/blog/ShareNetworkIcon";

describe("ShareNetworkIcon", () => {
  it("renders a distinct glyph per platform key", () => {
    const { container: x } = render(<ShareNetworkIcon icon="x" />);
    const { container: fb } = render(<ShareNetworkIcon icon="facebook" />);
    const { container: wa } = render(<ShareNetworkIcon icon="whatsapp" />);
    expect(x.querySelector("svg")).not.toBeNull();
    expect(fb.querySelector("svg")).not.toBeNull();
    expect(wa.querySelector("svg")).not.toBeNull();
    // Brand SVGs carry path data; each platform differs from the others.
    expect(x.innerHTML).not.toBe(fb.innerHTML);
    expect(x.innerHTML).not.toBe(wa.innerHTML);
    expect(fb.innerHTML).not.toBe(wa.innerHTML);
  });

  it("falls back to a generic glyph for unknown keys (never renders nothing)", () => {
    const { container } = render(<ShareNetworkIcon icon="totally-unknown" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
