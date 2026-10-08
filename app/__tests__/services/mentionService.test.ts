/**
 * Sprint 14: @mention extraction/diff (pure functions — no mocks needed).
 * Mirrors the client renderer in commentParser.tsx (`/@\w+/`), so every
 * rendered mention link is a notification candidate and nothing else is.
 */
import { extractMentionedUsernames, diffMentions } from "@/app/lib/services/mentionService"

describe("extractMentionedUsernames", () => {
  it("extracts @usernames and lowercases them", () => {
    expect(extractMentionedUsernames("Hey @Ama and @Boateng_12, check this")).toEqual([
      "ama",
      "boateng_12",
    ])
  })

  it("dedupes repeat mentions", () => {
    expect(extractMentionedUsernames("@ama ping @Ama ping @ama")).toEqual(["ama"])
  })

  it("returns [] for text without mentions", () => {
    expect(extractMentionedUsernames("Just a normal comment, no mentions here.")).toEqual([])
  })

  it("returns [] for empty input", () => {
    expect(extractMentionedUsernames("")).toEqual([])
  })

  it("caps the fan-out set so a spam comment cannot notify hundreds", () => {
    const spam = Array.from({ length: 30 }, (_, i) => `@user${i}`).join(" ")
    expect(extractMentionedUsernames(spam)).toHaveLength(10)
  })
})

describe("diffMentions", () => {
  it("returns only mentions added by an edit", () => {
    expect(diffMentions("cc @ama", "cc @ama and @kofi")).toEqual(["kofi"])
  })

  it("returns [] when the edit removes mentions", () => {
    expect(diffMentions("cc @ama", "no mentions here")).toEqual([])
  })

  it("returns [] when nothing changed", () => {
    expect(diffMentions("cc @ama", "cc @ama")).toEqual([])
  })
})
