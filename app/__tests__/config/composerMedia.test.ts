import {
  cleanupComposerPhotos,
  decideComposerPhotoCleanup,
} from "@/app/lib/utils/composerMedia";

const POST_URL =
  "https://res.cloudinary.com/demo/image/upload/v1710000000/along/posts/abc123.jpg";
const NON_CLOUDINARY = "https://example.com/images/pic.jpg";

describe("composer photo removal: clean + safe Cloudinary handling", () => {
  it("cleans up Cloudinary session uploads immediately", () => {
    expect(decideComposerPhotoCleanup(POST_URL)).toEqual({ shouldCleanup: true });
  });

  it("skips non-Cloudinary URLs (server allowlist is the final gate)", () => {
    const d = decideComposerPhotoCleanup(NON_CLOUDINARY);
    expect(d.shouldCleanup).toBe(false);
    expect(d.skipReason).toBe("not-cloudinary");
  });

  it("defers edit-originals to the PATCH removed-images diff (no immediate destroy)", () => {
    const d = decideComposerPhotoCleanup(POST_URL, { isEditOriginal: true });
    expect(d.shouldCleanup).toBe(false);
    expect(d.skipReason).toBe("edit-original");
  });

  it("respects the composer-remove kill switch", () => {
    const d = decideComposerPhotoCleanup(POST_URL, { cleanupEnabled: false });
    expect(d.shouldCleanup).toBe(false);
    expect(d.skipReason).toBe("cleanup-disabled");
  });

  it("rejects empty input without throwing", () => {
    expect(decideComposerPhotoCleanup("").shouldCleanup).toBe(false);
    expect(decideComposerPhotoCleanup(null).shouldCleanup).toBe(false);
  });

  it("cleanupComposerPhotos posts source=composer-remove and never throws", async () => {
    const spy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true } as Response);
    try {
      await expect(cleanupComposerPhotos([POST_URL])).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
      const [, init] = spy.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(String(init.body))).toMatchObject({
        urls: [POST_URL],
        source: "composer-remove",
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("cleanupComposerPhotos no-ops on empty input without network", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true } as Response);
    try {
      await expect(cleanupComposerPhotos([])).resolves.toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
