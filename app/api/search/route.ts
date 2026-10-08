import { NextRequest, NextResponse } from "next/server";
import { searchService } from "@/app/lib/services/searchService";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

const VALID_TYPES = new Set(["all", "posts", "users"]);
const VALID_POST_TYPES = new Set(["ROUTE", "ROUTE_REQUEST", "ROUTE_RESPONSE"]);

/**
 * GET /api/search?q=&type=all|posts|users&region=&postType=&limit=&cursor=
 * Guest-accessible discovery endpoint (matches /api/posts/feed guest fallback).
 * Rate-limited via the shared `search` bucket (30 req/min).
 */
export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, "search");
  if (!limited.allowed) return limited.response;

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();

    if (!q) {
      return NextResponse.json(
        { error: "Please enter a search term." },
        { status: 400 }
      );
    }
    if (q.length < 2) {
      return NextResponse.json(
        { posts: [], users: [], tags: [], nextCursor: null },
        { status: 200 }
      );
    }
    if (q.length > 100) {
      return NextResponse.json(
        { error: "Search term is too long. Please keep it under 100 characters." },
        { status: 400 }
      );
    }

    const rawType = searchParams.get("type") ?? "all";
    const type = VALID_TYPES.has(rawType) ? (rawType as "all" | "posts" | "users") : "all";
    const rawPostType = searchParams.get("postType");
    const postType =
      rawPostType && VALID_POST_TYPES.has(rawPostType)
        ? (rawPostType as "ROUTE" | "ROUTE_REQUEST" | "ROUTE_RESPONSE")
        : undefined;

    const result = await searchService.search({
      query: q,
      type,
      region: searchParams.get("region") ?? undefined,
      postType,
      limit: Math.min(Number(searchParams.get("limit")) || 10, 50),
      cursor: searchParams.get("cursor") ?? undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Search error:", error);
    const isPrismaKnown =
      error instanceof Error &&
      (error.name === "PrismaClientKnownRequestError" ||
        (error as { code?: string }).code === "P2022");
    const isPrismaInit =
      error instanceof Error && error.name === "PrismaClientInitializationError";
    if (isPrismaKnown || isPrismaInit) {
      return NextResponse.json(
        { error: "We're experiencing high demand. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
