import { NextResponse } from "next/server";

import { handleChatTurn } from "@/lib/ai/chat";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { searchId?: string | null; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Empty message" },
      { status: 400 },
    );
  }

  try {
    const result = await handleChatTurn({
      searchId: body.searchId ?? null,
      message,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Chat failed";
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
