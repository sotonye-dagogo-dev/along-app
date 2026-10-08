import { ROUTE_DRAFTS_CONFIG } from "@/app/lib/config/routeDrafts";
import { routeDraftsService } from "@/app/lib/services/routeDraftsService";

function installMemoryStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
  return { store, storage };
}

describe("execute-feature: route drafts library (config-driven, restorable)", () => {
  it("config carries storage keys, capacity, and labels", () => {
    expect(ROUTE_DRAFTS_CONFIG.collectionKey).toBe("along_route_drafts");
    expect(ROUTE_DRAFTS_CONFIG.legacyKey).toBe("along_route_draft");
    expect(ROUTE_DRAFTS_CONFIG.maxDrafts).toBeGreaterThan(0);
    expect(ROUTE_DRAFTS_CONFIG.changedEvent).toBe("along:drafts-changed");
    expect(ROUTE_DRAFTS_CONFIG.saveLabel.length).toBeGreaterThan(0);
    expect(ROUTE_DRAFTS_CONFIG.restoreLabel.length).toBeGreaterThan(0);
    expect(ROUTE_DRAFTS_CONFIG.continueLabel.length).toBeGreaterThan(0);
    expect(ROUTE_DRAFTS_CONFIG.resumeChipLabel(1)).toMatch("1 saved draft");
    expect(ROUTE_DRAFTS_CONFIG.resumeChipLabel(3)).toMatch("3 saved drafts");
  });

  it("saves, lists newest-first, restores by id, and deletes", () => {
    installMemoryStorage();
    expect(routeDraftsService.listDrafts()).toEqual([]);

    const first = routeDraftsService.saveDraft({
      title: "Marina to Yaba",
      steps: [
        { location: "Marina", description: "", vehicle: "bus", fare: 500 },
        { location: "Yaba", description: "", vehicle: "bus", fare: 300 },
      ],
      tags: ["lagos"],
      images: [],
    });
    expect(first).not.toBeNull();

    const second = routeDraftsService.saveDraft({
      title: "Ikeja to Lekki",
      steps: [
        { location: "Ikeja", description: "", vehicle: "bus", fare: 700 },
        { location: "Lekki", description: "", vehicle: "bus", fare: 900 },
      ],
      tags: [],
      images: [],
    });
    const listed = routeDraftsService.listDrafts();
    expect(listed).toHaveLength(2);
    expect(listed[0].id).toBe(second!.id);

    const restored = routeDraftsService.getDraft(first!.id);
    expect(restored?.title).toBe("Marina to Yaba");
    expect(restored?.steps).toHaveLength(2);

    const afterDelete = routeDraftsService.deleteDraft(first!.id);
    expect(afterDelete).toHaveLength(1);
    expect(routeDraftsService.getDraft(first!.id)).toBeNull();
  });

  it("refuses empty drafts and survives corrupt payloads", () => {
    const { store } = installMemoryStorage();
    expect(
      routeDraftsService.saveDraft({ title: "  ", steps: [], tags: [], images: [] })
    ).toBeNull();
    store.set(ROUTE_DRAFTS_CONFIG.collectionKey, "not-json{{{");
    expect(routeDraftsService.listDrafts()).toEqual([]);
    expect(routeDraftsService.countDrafts()).toBe(0);
  });

  it("migrates the legacy single-draft key into the collection once", () => {
    const { store } = installMemoryStorage();
    store.set(
      ROUTE_DRAFTS_CONFIG.legacyKey,
      JSON.stringify({ title: "Legacy draft", steps: [], tags: [], images: [] })
    );
    const migrated = routeDraftsService.listDrafts();
    expect(migrated).toHaveLength(1);
    expect(migrated[0].title).toBe("Legacy draft");
  });
});
