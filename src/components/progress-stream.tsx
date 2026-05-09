"use client";

import * as React from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import type { ProgressEvent, TripOption } from "@/types";

type Status = "idle" | "running" | "done" | "error";

export function ProgressStream({
  searchId,
  snapshotId,
  onPartial,
  onDone,
}: {
  searchId: string;
  snapshotId: string;
  onPartial?: (trips: TripOption[]) => void;
  onDone?: (trips: TripOption[]) => void;
}) {
  const [status, setStatus] = React.useState<Status>("running");
  const [phaseLabel, setPhaseLabel] = React.useState("Starting…");
  const [progress, setProgress] = React.useState(0);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [latestTrips, setLatestTrips] = React.useState<TripOption[]>([]);

  React.useEffect(() => {
    const url = `/api/searches/${searchId}/stream?snapshot=${snapshotId}`;
    const es = new EventSource(url);

    function handle(event: MessageEvent, parsed: ProgressEvent) {
      switch (parsed.type) {
        case "phase":
          setPhaseLabel(parsed.message);
          break;
        case "progress": {
          const pct = parsed.total > 0 ? (parsed.current / parsed.total) * 100 : 0;
          const phaseTitle =
            parsed.phase === "pricing"
              ? "Pricing flights"
              : parsed.phase === "hotels"
                ? "Searching hotels"
                : parsed.phase;
          setPhaseLabel(
            `${phaseTitle}${parsed.label ? ` · ${parsed.label}` : ""} (${parsed.current}/${parsed.total})`,
          );
          setProgress((cur) => Math.max(cur, pct * 0.9));
          break;
        }
        case "partial":
          setLatestTrips(parsed.trips);
          onPartial?.(parsed.trips);
          break;
        case "result":
          setLatestTrips(parsed.trips);
          setProgress(95);
          break;
        case "done":
          setProgress(100);
          setStatus("done");
          setPhaseLabel("Search complete");
          onDone?.(latestTrips);
          es.close();
          break;
        case "error":
          setStatus("error");
          setErrorMsg(parsed.message);
          es.close();
          break;
      }
    }

    const wireEvent = (eventName: ProgressEvent["type"]) => {
      es.addEventListener(eventName, (event) => {
        try {
          const parsed = JSON.parse(
            (event as MessageEvent).data,
          ) as ProgressEvent;
          handle(event as MessageEvent, parsed);
        } catch (err) {
          console.error("bad SSE payload", err);
        }
      });
    };

    (
      ["phase", "progress", "partial", "result", "done", "error"] as const
    ).forEach(wireEvent);

    es.onerror = () => {
      if (status === "running") {
        setStatus("error");
        setErrorMsg("Stream disconnected");
      }
      es.close();
    };

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId, snapshotId]);

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-card p-3 text-sm">
        <CheckCircle2 className="size-4 text-green-600" />
        <span>Search complete</span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircle className="size-4" />
        <span>{errorMsg ?? "Search failed"}</span>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-md border bg-card p-3">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>{phaseLabel}</span>
      </div>
      <Progress value={progress} />
    </div>
  );
}
