/**
 * Feed first-load hydration — regression guard.
 *
 * The home feed waits for an optional passive geo fix before its single
 * first fetch. The fix can arrive AFTER the geo-wait timer has already
 * started that fetch, which re-runs the init effect. The old cleanup only
 * set `cancelled` and left the one-shot viewer guard armed, so the awaited
 * commit was dropped and the next effect refused to fetch again — the feed
 * stayed on its skeleton until a remount (navigate away and back).
 *
 * The fix: split "started" from "settled" and release the guard on cleanup
 * when a started load never committed, so the next run retries.
 */
import fs from "fs";
import path from "path";
import { FEED_FIRST_LOAD_CONFIG } from "@/app/lib/config/feedAlgorithm";
import { MAP_PINS_CONFIG } from "@/app/lib/config/mapPins";

const ROOT = path.resolve(__dirname, "..", "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const HOME = "app/(dashboard)/home/page.tsx";

describe("feed first-load hydration", () => {
  const src = read(HOME);

  it("tracks started vs settled initial loads", () => {
    expect(src).toContain("let started = false");
    expect(src).toContain("let settled = false");
    expect(src).toContain("settled = true");
  });

  it("releases the one-shot guard when a started load is cancelled", () => {
    expect(src).toMatch(/if \(started && !settled\) startedFor\.delete\(viewerKey\)/);
  });

  it("only arms the guard from the actual loader (single owner)", () => {
    expect(src).toMatch(/runInitial[\s\S]{0,300}startedFor\.add\(viewerKey\)/);
    expect(src).not.toMatch(/geoTimer = setTimeout\([\s\S]{0,200}startedFor\.add/);
  });

  it("still commits a ready state on both success and failure", () => {
    expect(src).toContain("setIsReady(true)");
    expect(src).toContain("readyRef.current = true");
  });

  it("keeps the geo wait shorter than the geolocation timeout (the race window is real)", () => {
    expect(FEED_FIRST_LOAD_CONFIG.geoWaitMs).toBeLessThan(MAP_PINS_CONFIG.tracking.timeoutMs);
  });
});
