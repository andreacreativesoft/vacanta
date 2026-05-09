import { NextResponse } from "next/server";

import { subscribe, getRun } from "@/lib/search/runner";
import { eventToSse, sseFormat } from "@/lib/search/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await ctx.params; // satisfy promise
  const url = new URL(request.url);
  const snapshotId = url.searchParams.get("snapshot");
  if (!snapshotId) {
    return NextResponse.json(
      { ok: false, error: "snapshot id required" },
      { status: 400 },
    );
  }

  const run = getRun(snapshotId);
  if (!run) {
    return NextResponse.json(
      { ok: false, error: "Run not active. Reload to see saved results." },
      { status: 410 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      safeEnqueue(sseFormat("hello", { snapshotId }));

      const unsubscribe = subscribe(snapshotId, (event) => {
        safeEnqueue(eventToSse(event));
        if (event.type === "done" || event.type === "error") {
          closed = true;
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        }
      });

      const heartbeat = setInterval(() => {
        safeEnqueue(`: keepalive\n\n`);
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        closed = true;
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
