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
import { ResultsList } from "@/components/results-list";
import { ChatPanel } from "@/components/chat-panel";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { countryName } from "@/lib/airports/countries";
import type {
  ChatMessage,
  SearchDetailDto,
} from "@/types/dto";

export function SearchDetail({
  initial,
  initialChat,
}: {
  initial: SearchDetailDto;
  initialChat: ChatMessage[];
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);
  const snapshots = initial.snapshots;

  const params = initial.search.params;
  const latest = snapshots[0];
  const trips = latest?.trips ?? [];

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/searches/${initial.search.id}`, {
        method: "POST",
      });
      const data = (await res.json()) as
        | { ok: true; snapshotId: string; tripCount: number }
        | { ok: false; error: string };
      if (!res.ok || !("ok" in data) || !data.ok) {
        toast.error("error" in data ? data.error : "Refresh failed");
        return;
      }
      toast.success(`Refreshed — ${data.tripCount} trips`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setRefreshing(false);
    }
  }

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
              {params.filters.pool && (
                <Badge variant="outline">Pool</Badge>
              )}
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
              disabled={refreshing}
            >
              {refreshing ? (
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

      {latest?.status === "error" && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">
            Search failed: {latest.errorMessage ?? "unknown error"}
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
