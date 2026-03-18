import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateResolutionQuestions, applyResolutionAnswers } from "@/lib/llm/geminiClient";

export async function POST(request: NextRequest) {
  const rateLimitError = checkRateLimit(request);
  if (rateLimitError) return rateLimitError;

  const authError = checkApiKey(request);
  if (authError) return authError;

  let body: { action: string; issue?: { field: string; issue: string; severity: string }; answers?: Record<string, string>; patient_record?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, issue, patient_record } = body;

  if (!action || !issue || !patient_record) {
    return NextResponse.json(
      { error: "Missing required fields: action, issue, patient_record" },
      { status: 400 }
    );
  }

  try {
    if (action === "get_questions") {
      const result = await generateResolutionQuestions(issue, patient_record);
      return NextResponse.json(result);
    }

    if (action === "apply_answers") {
      if (!body.answers) {
        return NextResponse.json({ error: "Missing answers" }, { status: 400 });
      }
      const result = await applyResolutionAnswers(issue, body.answers, patient_record);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action. Use 'get_questions' or 'apply_answers'" }, { status: 400 });
  } catch (err) {
    console.error("Issue resolution error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
