import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { v2 as cloudinary } from "cloudinary";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"];

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

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Too many files. Maximum is ${MAX_FILES}` }, { status: 400 });
    }

    const urls: string[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `Unsupported file type: ${file.type}. Use JPEG, PNG, WebP or GIF.` }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File ${file.name} exceeds 5MB limit` }, { status: 400 });
      }
      if (file.size === 0) {
        return NextResponse.json({ error: `File ${file.name} is empty` }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

      const result = await cloudinary.uploader.upload(base64, {
        folder: "along/posts",
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
