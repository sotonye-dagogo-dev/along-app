import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { v2 as cloudinary } from "cloudinary";
import { REPORT_ATTACHMENTS_CONFIG } from "@/app/lib/config/reportAttachments";
import { BLOG_IMAGE_CONFIG } from "@/app/lib/config/blogManagement";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"];

/**
 * Per-folder upload policy (config-driven). `posts` keeps the legacy limits;
 * `reports` enforces the report-attachment contract (≤3 files, ≤2MB each)
 * from REPORT_ATTACHMENTS_CONFIG. Unknown folders are rejected — uploads can
 * only land where the cleanup allowlist can later purge them.
 */
const FOLDER_POLICIES: Record<string, { folder: string; maxFiles: number; maxBytes: number; allowedTypes: string[] }> = {
  posts: { folder: "along/posts", maxFiles: MAX_FILES, maxBytes: MAX_FILE_SIZE, allowedTypes: ALLOWED_TYPES },
  reports: {
    folder: REPORT_ATTACHMENTS_CONFIG.folder,
    maxFiles: REPORT_ATTACHMENTS_CONFIG.maxImages,
    maxBytes: REPORT_ATTACHMENTS_CONFIG.maxBytesPerImage,
    allowedTypes: REPORT_ATTACHMENTS_CONFIG.allowedTypes,
  },
  // Blog Studio covers + inline images (caps/types from BLOG_IMAGE_CONFIG).
  [BLOG_IMAGE_CONFIG.uploadFolderKey]: {
    folder: BLOG_IMAGE_CONFIG.folder,
    maxFiles: BLOG_IMAGE_CONFIG.maxInlineImages,
    maxBytes: BLOG_IMAGE_CONFIG.maxBytesPerImage,
    allowedTypes: BLOG_IMAGE_CONFIG.allowedTypes,
  },
};

function resolveFolderPolicy(raw: string | null) {
  const key = (raw ?? "posts").trim().toLowerCase();
  return FOLDER_POLICIES[key] ?? null;
}

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return false;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!configureCloudinary()) {
      return NextResponse.json(
        { error: "Image upload is not configured. Please contact support." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("file") as File[];
    const folderParam =
      (formData.get("folder") as string | null) ?? new URL(request.url).searchParams.get("folder");
    const policy = resolveFolderPolicy(folderParam);
    if (!policy) {
      return NextResponse.json({ error: "Unknown upload folder." }, { status: 400 });
    }
    if (policy.folder === REPORT_ATTACHMENTS_CONFIG.folder && !REPORT_ATTACHMENTS_CONFIG.enabled) {
      return NextResponse.json({ error: "Report attachments are disabled." }, { status: 400 });
    }
    // Blog uploads back the admin-only Studio — non-admins cannot land assets
    // in the blog folder (keeps the cleanup allowlist + billing disjoint).
    if (policy.folder === BLOG_IMAGE_CONFIG.folder && (user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Not authorized for blog uploads." }, { status: 403 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }
    if (files.length > policy.maxFiles) {
      return NextResponse.json({ error: `Too many files. Maximum is ${policy.maxFiles}` }, { status: 400 });
    }

    const urls: string[] = [];

    for (const file of files) {
      if (!policy.allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `Unsupported file type: ${file.type}. Use JPEG, PNG, WebP or GIF.` }, { status: 400 });
      }
      if (file.size > policy.maxBytes) {
        const mb = policy.maxBytes / (1024 * 1024);
        return NextResponse.json({ error: `File ${file.name} exceeds ${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB limit` }, { status: 400 });
      }
      if (file.size === 0) {
        return NextResponse.json({ error: `File ${file.name} is empty` }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

      const result = await cloudinary.uploader.upload(base64, {
        folder: policy.folder,
        resource_type: "image",
        transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto", fetch_format: "auto" }],
      });

      urls.push(result.secure_url);
    }

    return NextResponse.json({ urls }, { status: 200 });
  } catch (error) {
    console.error("Upload error:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Upload failed";
    // Do not leak cloudinary internals if it's a config issue
    if (message.toLowerCase().includes("cloudinary") || message.toLowerCase().includes("api_key")) {
      return NextResponse.json({ error: "Image service unavailable. Please try again." }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to upload images. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST with multipart/form-data." }, { status: 405 });
}
