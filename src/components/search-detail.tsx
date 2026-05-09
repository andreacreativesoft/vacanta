"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, MessageSquare, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { ResultsList } from "@/components/results-list";
import { ChatPanel } from "@/components/chat-panel";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { countryName } from "@/lib/airports/countries";
import type { ChatMessage, SearchDetailDto } from "@/types/dto";

type StepResponse = {
  ok: boolean;
  done?: boolean;
  phase?: string;
  current?: number;
  total?: number;
  label?: string;
  status?: "running" | "complete" | "error";
  errorMessage?: string;
  error?: string;
};

const PHASE_LABELS: Record<string, string> = {
  init: "Starting…",
  routes: "Resolving routes…",
  pricing: "Pricing flights",
  hotels: "Searching hotels",
  complete: "Done",
  error: "Error",
};

export function SearchDetail({
  initial,
  initialChat,
}: {
  initial: SearchDetailDto;
  initialChat: ChatMessage[];
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const params = initial.search.params;
  const initialLatest = initial.snapshots[0];
  const initialTrips = initialLatest?.trips ?? [];

  const [activeSnapshotId, setActiveSnapshotId] = React.useState<string | null>(
    initialLatest?.status === "running" ? initialLatest.id : null,
  );
  const [progress, setProgress] = React.useState<{
    phase: string;
    current: number;
    total: number;
    label: string;
  } | null>(
    initialLatest?.status === "running"
      ? {
          phase: initialLatest.phase ?? "init",
          current: 0,
          total: 1,
          label: PHASE_LABELS[initialLatest.phase ?? "init"] ?? "Starting…",
        }
      : null,
  );
  const [errorMsg, setErrorMsg] = React.useState<string | null>(
    initialLatest?.status === "error"
      ? (initialLatest.errorMessage ?? "Search failed")
      : null,
  );

  // Poll the step endpoint while a snapshot is running.
  React.useEffect(() => {
    if (!activeSnapshotId) return;
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(
          `/api/searches/${initial.search.id}/step?snapshot=${activeSnapshotId}`,
          { method: "POST" },
        );
        const data = (await res.json()) as StepResponse;
        if (cancelled) return;
        if (!data.ok) {
          setErrorMsg(data.error ?? "Step failed");
          setActiveSnapshotId(null);
          return;
        }
        setProgress({
          phase: data.phase ?? "running",
          current: data.current ?? 0,
          total: data.total ?? 1,
          label:
            data.label ??
            PHASE_LABELS[data.phase ?? "running"] ??
            "Working…",
        });
        if (data.done || data.status !== "running") {
          setActiveSnapshotId(null);
          if (data.status === "error") {
            setErrorMsg(data.errorMessage ?? "Search failed");
          } else {
            // refresh server data so the new snapshot's trips render
            router.refresh();
          }
          return;
        }
        // Continue polling
        setTimeout(tick, 50);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Network error");
        setActiveSnapshotId(null);
      }
    }

    void tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSnapshotId]);

  async function refresh() {
    setRefreshing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/searches/${initial.search.id}`, {
        method: "POST",
      });
      const data = (await res.json()) as
        | { ok: true; snapshotId: string }
        | { ok: false; error: string };
      if (!res.ok || !("ok" in data) || !data.ok) {
        toast.error("error" in data ? data.error : "Refresh failed");
        return;
      }
      setActiveSnapshotId(data.snapshotId);
      setProgress({
        phase: "init",
        current: 0,
        total: 1,
        label: "Starting…",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setRefreshing(false);
    }
  }

  const isRunning = activeSnapshotId !== null;
  const trips = isRunning ? [] : initialTrips;
  const snapshots = initial.snapshots;
  const progressPct =
    progress && progress.total > 0
      ? Math.min(95, (progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg sm:text-xl break-words">
              {initial.search.label ??
                `${params.destinationCountries.map(countryName).join(", ")} · ${formatDate(params.dateWindowStart)} – ${formatDate(params.dateWindowEnd)}`}
            </CardTitle>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <Badge variant="outline">From {params.origins.join(", ")}</Badge>
              <Badge variant="outline">
                {params.minDays}-{params.maxDays} nights
              </Badge>
              <Badge variant="outline">
                {params.passengers.length} pax
              </Badge>
              <Badge variant="outline">{params.currency}</Badge>
              {params.filters.pool && <Badge variant="outline">Pool</Badge>}
              {params.filters.allInclusive && (
                <Badge variant="outline">All-inclusive</Badge>
              )}
              {typeof params.filters.maxDistanceToBeachMeters ===
                "number" && (
                <Badge variant="outline">
                  Beach &lt; {params.filters.maxDistanceToBeachMeters}m
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={refreshing || isRunning}
            >
              {refreshing || isRunning ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Searching…
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" /> Refresh
                </>
              )}
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm">
                  <MessageSquare className="size-4" /> Chat
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-full flex-col p-0 sm:max-w-md"
              >
                <SheetHeader className="border-b">
                  <SheetTitle>Ask about this search</SheetTitle>
                </SheetHeader>
                <ChatPanel
                  searchId={initial.search.id}
                  initialMessages={initialChat}
                />
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
      </Card>

      {isRunning && progress && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>{progress.label}</span>
              {progress.total > 1 && (
                <span className="text-muted-foreground">
                  ({progress.current}/{progress.total})
                </span>
              )}
            </div>
            <Progress value={progressPct} />
          </CardContent>
        </Card>
      )}

      {errorMsg && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">
            {errorMsg}
          </CardContent>
        </Card>
      )}

      <ResultsList trips={trips} />

      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Snapshot history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {snapshots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between border-b py-2 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        s.status === "complete"
                          ? "secondary"
                          : s.status === "error"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {s.status}
                    </Badge>
                    <span>{formatDateTime(s.startedAt)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {s.trips.length > 0
                      ? `${s.trips.length} trips · cheapest ${formatPrice(
                          s.trips[0].totalPrice,
                          s.trips[0].currency,
                        )}`
                      : (s.errorMessage ?? "—")}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Separator />
      <p className="text-xs text-muted-foreground">
        Saved as <code>{initial.search.id}</code>
      </p>
    </div>
  );
}
