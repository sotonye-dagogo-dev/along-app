import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { AppUserLabel } from "@/app/components/ui/AppUserLabel";

const repoRoot = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

const baseUser = {
  firstName: "Ada",
  lastName: "Obi",
  userName: "adaobi",
};

describe("AppUserLabel admin-tag extension (non-breaking)", () => {
  it("renders the role tag when roleLabel is provided", () => {
    render(<AppUserLabel user={baseUser} roleLabel="Admin" />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Ada Obi")).toBeInTheDocument();
  });

  it("omits the role tag when roleLabel is absent (legacy behaviour preserved)", () => {
    const { container } = render(<AppUserLabel user={baseUser} />);
    expect(container.textContent).not.toContain("Admin");
  });

  it("still links the whole component to the user profile with the tag", () => {
    render(<AppUserLabel user={baseUser} roleLabel="Mod" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/profile/adaobi");
    expect(link.textContent).toContain("Mod");
  });
});

describe("admin shell: scrollability + avatar consistency + analytics entry", () => {
  const shell = read("app/admin/AdminShell.tsx");

  it("renders the links region as a flex-1 scrollable container (overflow-safe)", () => {
    expect(shell).toContain("flex-1 min-h-0 overflow-y-auto");
  });

  it("keeps the identity footer pinned outside the scroll region", () => {
    expect(shell).toContain("mt-auto");
  });

  it("uses the platform AppUserLabel/AppAvatar for the admin identity (links to profile)", () => {
    expect(shell).toContain("AppUserLabel");
    expect(shell).toContain("AppAvatar");
    expect(shell).toContain("linkToProfile");
    expect(shell).toContain("roleLabel");
    // No more hardcoded initials circle.
    expect(shell).not.toContain("bg-primary-muted flex items-center justify-center text-sm font-bold text-primary shrink-0");
  });

  it("exposes the dedicated analytics page in the admin nav", () => {
    expect(shell).toContain('"/admin/analytics"');
  });

  it("ships the dedicated admin analytics page + API", () => {
    expect(fs.existsSync(path.join(repoRoot, "app/admin/analytics/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "app/api/admin/analytics/route.ts"))).toBe(true);
    const page = read("app/admin/analytics/page.tsx");
    expect(page).toContain("ADMIN_ANALYTICS_CONFIG");
    expect(page).toContain("SvgChartContainer");
    expect(page).toContain("ChartTooltipWrapper");
    const api = read("app/api/admin/analytics/route.ts");
    expect(api).toContain("parseAdminDashboardPeriod");
    expect(api).toContain("Unauthorized");
  });
});
