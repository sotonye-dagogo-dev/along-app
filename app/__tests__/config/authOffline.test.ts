import {
  AUTH_OFFLINE_CONFIG,
  readAuthSnapshot,
  writeAuthSnapshot,
  clearAuthSnapshot,
} from "@/app/lib/config/authOffline";

const SNAPSHOT_USER = {
  id: "u1",
  userName: "ada",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  role: "USER",
};

describe("authOffline config", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a server-confirmed snapshot", () => {
    writeAuthSnapshot(SNAPSHOT_USER);
    expect(readAuthSnapshot()).toEqual(expect.objectContaining({ id: "u1", userName: "ada" }));
  });

  it("returns null when nothing was stored", () => {
    expect(readAuthSnapshot()).toBeNull();
  });

  it("clears on logout / genuine 401", () => {
    writeAuthSnapshot(SNAPSHOT_USER);
    clearAuthSnapshot();
    expect(readAuthSnapshot()).toBeNull();
  });

  it("ignores stale snapshots past the TTL (never resurrect old identity)", () => {
    writeAuthSnapshot(SNAPSHOT_USER);
    const raw = window.localStorage.getItem(AUTH_OFFLINE_CONFIG.storageKey);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    parsed.savedAt = Date.now() - AUTH_OFFLINE_CONFIG.ttlMs - 1000;
    window.localStorage.setItem(AUTH_OFFLINE_CONFIG.storageKey, JSON.stringify(parsed));
    expect(readAuthSnapshot()).toBeNull();
  });

  it("ignores corrupt payloads instead of throwing", () => {
    window.localStorage.setItem(AUTH_OFFLINE_CONFIG.storageKey, "not-json{{{");
    expect(readAuthSnapshot()).toBeNull();
    window.localStorage.setItem(AUTH_OFFLINE_CONFIG.storageKey, JSON.stringify({ user: { nope: true } }));
    expect(readAuthSnapshot()).toBeNull();
  });
});
