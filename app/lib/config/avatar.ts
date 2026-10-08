import type { AvatarConfig } from "@/app/lib/types";

const DICEBEAR_BASE = "https://api.dicebear.com/9.x";

export interface AvatarStyleMeta {
  value: string;
  label: string;
  category: "People" | "Robots" | "Fun" | "Abstract";
  description: string;
}

/**
 * Curated DiceBear style catalogue. DiceBear ships 20+ styles; exposing all
 * of them overwhelms users, so we surface a curated dozen with plain-language
 * descriptions grouped by category. `value` must stay a valid DiceBear 9.x
 * collection slug.
 */
export const AVATAR_STYLES: AvatarStyleMeta[] = [
  { value: "avataaars", label: "Avataaars", category: "People", description: "Friendly cartoon people" },
  { value: "personas", label: "Personas", category: "People", description: "Modern flat portraits" },
  { value: "lorelei", label: "Lorelei", category: "People", description: "Soft illustrated faces" },
  { value: "notionists", label: "Notionists", category: "People", description: "Playful hand-drawn look" },
  { value: "micah", label: "Micah", category: "People", description: "Casual everyday characters" },
  { value: "miniavs", label: "Miniavs", category: "People", description: "Tiny expressive avatars" },
  { value: "adventurer", label: "Adventurer", category: "Fun", description: "Bold traveller vibes" },
  { value: "big-smile", label: "Big Smile", category: "Fun", description: "Cheerful smiley faces" },
  { value: "bottts", label: "Bottts", category: "Robots", description: "Cute robot heads" },
  { value: "pixel-art", label: "Pixel Art", category: "Fun", description: "Retro 8-bit sprites" },
  { value: "initials", label: "Initials", category: "Abstract", description: "Clean letter monogram" },
  { value: "identicons", label: "Identicon", category: "Abstract", description: "Unique geometric pattern" },
];

export const AVATAR_CATEGORIES = ["All", "People", "Robots", "Fun", "Abstract"] as const;

/** Background swatches (hex without #). Empty string = transparent. */
export const AVATAR_BACKGROUNDS: { label: string; value: string }[] = [
  { label: "Transparent", value: "" },
  { label: "Mint", value: "d1fae5" },
  { label: "Sky", value: "dbeafe" },
  { label: "Peach", value: "ffedd5" },
  { label: "Lilac", value: "ede9fe" },
  { label: "Rose", value: "fce7f3" },
  { label: "Sand", value: "fef3c7" },
  { label: "Forest", value: "064e3b" },
];

/**
 * Curated seed ideas so users who don't know what to type can one-tap to a
 * good result. Any word works as a seed — these are just starting points.
 */
export const AVATAR_SEED_PRESETS: string[] = [
  "Ada",
  "Chidi",
  "Funmi",
  "Tunde",
  "Ngozi",
  "Emeka",
  "Aisha",
  "Lagos",
  "Sunny",
  "Navigator",
  "Explorer",
  "Cruiser",
];

export const AVATAR_EDITOR_CONFIG = {
  seedLabel: "Name or word (seed)",
  seedPlaceholder: "e.g. Ada, Lagos, Sunny…",
  seedHint: "Any word works — the same word always gives the same avatar. Try your name, a nickname, or a city.",
  presetsLabel: "Try one-tap ideas",
  randomLabel: "Surprise me",
  randomAriaLabel: "Generate a random avatar",
  backgroundLabel: "Background",
  flipLabel: "Mirror avatar",
  styleLabel: "Style",
  previewLabel: "Preview",
  tipTitle: "How to get what you want",
  tips: [
    "Pick a style first — People styles look like you, Robots and Fun are playful.",
    "Type any word as the seed; small changes (Ada → Adaeze) give a fresh face.",
    "Hit Surprise me until one clicks, then tweak the background.",
  ],
} as const;

export function buildAvatarUrl(config: AvatarConfig): string {
  const params = new URLSearchParams();
  if (config.seed) params.set("seed", config.seed);
  if (config.flip) params.set("flip", "true");
  if (config.backgroundColor) params.set("backgroundColor", config.backgroundColor);
  const qs = params.toString();
  return `${DICEBEAR_BASE}/${config.style}/svg${qs ? `?${qs}` : ""}`;
}

export function getFallbackAvatarUrl(firstName: string): string {
  return `${DICEBEAR_BASE}/avataaars/svg?seed=${encodeURIComponent(firstName)}`;
}

/** Random seed helper for the "Surprise me" dice button. */
export function randomAvatarSeed(): string {
  const words = ["Ada", "Chidi", "Funmi", "Tunde", "Lagos", "Abuja", "Sunny", "River", "Comet", "Navigator", "Palm", "Zebra"];
  const pick = words[Math.floor(Math.random() * words.length)];
  const suffix = Math.floor(Math.random() * 99) + 1;
  return `${pick}-${suffix}`;
}
