import { NextRequest, NextResponse } from "next/server";
import { DataQualityRequestSchema } from "@/lib/types";
import { checkApiKey } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { evaluateDataQuality } from "@/lib/dataQualityEngine";

export async function POST(request: NextRequest) {
  const rateLimitError = checkRateLimit(request);
  if (rateLimitError) return rateLimitError;

  const authError = checkApiKey(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = DataQualityRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await evaluateDataQuality(parsed.data);

    // Fire webhook asynchronously if provided
    if (parsed.data.webhook_url) {
      fireWebhook(parsed.data.webhook_url, result).catch((err) =>
        console.error("Webhook delivery failed:", err)
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Data quality evaluation error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function fireWebhook(url: string, payload: unknown): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "data_quality.completed", data: payload }),
  });
  if (!response.ok) {
    console.error(`Webhook returned ${response.status}: ${await response.text()}`);
  }
}
