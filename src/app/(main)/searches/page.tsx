import Link from "next/link";

import { listSearches, snapshotTrips } from "@/lib/db/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { countryName } from "@/lib/airports/countries";
import type { SearchInput } from "@/types";

export const dynamic = "force-dynamic";

export default async function SearchesPage() {
  const rows = await listSearches();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Saved searches</h1>
          <p className="text-sm text-muted-foreground">
            Each search keeps a history of price snapshots over time.
          </p>
        </div>
        <Button asChild>
          <Link href="/">New search</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No searches yet — start one from the home page.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map(({ search, latest }) => {
            const params = JSON.parse(search.paramsJson) as SearchInput;
            const trips = snapshotTrips(latest);
            const cheapest = trips[0];
            return (
              <Card key={search.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <Link
                      href={`/searches/${search.id}`}
                      className="font-medium hover:underline"
                    >
                      {search.label ??
                        `${params.destinationCountries.map(countryName).join(", ")} · ${formatDate(params.dateWindowStart)}`}
                    </Link>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">
                        {params.origins.join(",")} →{" "}
                        {params.destinationCountries.join(",")}
                      </Badge>
                      <Badge variant="outline">
                        {params.minDays}–{params.maxDays}n
                      </Badge>
                      <Badge variant="outline">
                        {params.passengers.length} pax
                      </Badge>
                      {latest && (
                        <Badge
                          variant={
                            latest.status === "complete"
                              ? "secondary"
                              : latest.status === "error"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {latest.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(search.createdAt)}
                      {latest
                        ? ` · last run ${formatDateTime(latest.startedAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    {cheapest ? (
                      <>
                        <div className="text-lg font-semibold">
                          {formatPrice(
                            cheapest.totalPrice,
                            cheapest.currency,
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {cheapest.destinationCity}
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No results yet
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
