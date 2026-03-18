import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "./types";

export function checkApiKey(request: NextRequest): NextResponse<ApiError> | null {
  const key = request.headers.get("x-api-key");
  const secret = process.env.API_SECRET_KEY;

  if (!secret) return null;

  if (!key || key !== secret) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid x-api-key header." },
      { status: 401 }
    );
  }

  return null;
}
