import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        avatar: true,
        avatarConfig: true,
        bio: true,
        verified: true,
        rewardPoints: true,
        rewardTier: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const avgValidity = await prisma.post.aggregate({
      where: { userId: id },
      _avg: { validityScore: true },
    });

    // Best-effort early-adopter badge (config-driven; never fails the request).
    let earlyAdopter: unknown = null;
    try {
      const { getEarlyAdopterStatus } = await import(
        "@/app/lib/services/earlyAdopterService"
      );
      earlyAdopter = await getEarlyAdopterStatus(id);
    } catch {
      earlyAdopter = null;
    }

    return NextResponse.json({
      user: {
        ...user,
        avgValidityScore: Math.round(avgValidity._avg.validityScore ?? 0),
        postCount: user._count.posts,
        followerCount: user._count.followers,
        followingCount: user._count.following,
        earlyAdopter,
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getUserFromRequest();

    if (!currentUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (currentUser.id !== id) {
      return NextResponse.json({ error: "You can only edit your own profile" }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = ["userName", "firstName", "lastName", "bio", "avatar"];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Username stays globally unique: validate shape, then confirm no OTHER
    // user holds it (self-keeping the same name is always allowed).
    if (typeof updateData.userName === "string") {
      const { USERNAME_RULE } = await import("@/app/lib/config/forms");
      const candidate = updateData.userName.trim();
      if (
        candidate.length < USERNAME_RULE.minLength ||
        candidate.length > USERNAME_RULE.maxLength ||
        !USERNAME_RULE.pattern.test(candidate)
      ) {
        return NextResponse.json(
          { error: "Username must be 3-30 characters and contain only letters, numbers, and underscores" },
          { status: 400 }
        );
      }
      const taken = await prisma.user.findUnique({ where: { userName: candidate } });
      if (taken && taken.id !== id) {
        return NextResponse.json({ error: "Username already exists" }, { status: 409 });
      }
      updateData.userName = candidate;
    }

    let user;
    try {
      user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          userName: true,
          firstName: true,
          lastName: true,
          avatar: true,
          avatarConfig: true,
          bio: true,
          verified: true,
          rewardPoints: true,
          rewardTier: true,
        },
      });
    } catch (error) {
      // Race guard: the unique index is the final arbiter (two users claiming
      // the same name at once) — translate it to the same 409.
      if ((error as { code?: string })?.code === "P2002") {
        return NextResponse.json({ error: "Username already exists" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
