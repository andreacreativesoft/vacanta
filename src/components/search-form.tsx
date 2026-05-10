"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_COUNTRIES, SUPPORTED_ORIGINS } from "@/lib/airports/countries";
import { classifyAge } from "@/lib/validation";

type ChildEntry = { id: string; age: number };
type RoomEntry = { adults: number; children: number };

const todayPlus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function SearchForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const [origins, setOrigins] = React.useState<string[]>([
    "OTP",
    "GHV",
    "SBZ",
  ]);
  const [destinations, setDestinations] = React.useState<string[]>(["GR", "CY"]);
  const [dateStart, setDateStart] = React.useState(todayPlus(60));
  const [dateEnd, setDateEnd] = React.useState(todayPlus(120));
  const [minDays, setMinDays] = React.useState(7);
  const [maxDays, setMaxDays] = React.useState(10);
  const [adults, setAdults] = React.useState(3);
  const [children, setChildren] = React.useState<ChildEntry[]>([
    { id: "default-child", age: 12 },
  ]);
  const [rooms, setRooms] = React.useState<RoomEntry[]>([
    { adults: 3, children: 1 },
  ]);
  const [pool, setPool] = React.useState(true);
  const [allInclusive, setAllInclusive] = React.useState(false);
  const [maxBeach, setMaxBeach] = React.useState<number | "">(500);
  const [minRating, setMinRating] = React.useState<number | "">(7);
  const [maxBudget, setMaxBudget] = React.useState<number | "">("");
  const [currency, setCurrency] = React.useState<"EUR" | "RON" | "USD">("EUR");
  const [label, setLabel] = React.useState("");

  const totalAdults = adults;
  const totalChildren = children.length;
  const occupantsAdults = rooms.reduce((s, r) => s + r.adults, 0);
  const occupantsChildren = rooms.reduce((s, r) => s + r.children, 0);
  const occupantsMatch =
    occupantsAdults === totalAdults && occupantsChildren === totalChildren;

  function addChild() {
    setChildren((cs) => [
      ...cs,
      { id: crypto.randomUUID(), age: 8 },
    ]);
  }
  function removeChild(id: string) {
    setChildren((cs) => cs.filter((c) => c.id !== id));
  }
  function addRoom() {
    setRooms((rs) => [...rs, { adults: 1, children: 0 }]);
  }
  function removeRoom(idx: number) {
    setRooms((rs) => rs.filter((_, i) => i !== idx));
  }
  function toggleArray(
    list: string[],
    setList: (next: string[]) => void,
    value: string,
  ) {
    setList(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (origins.length === 0) {
      toast.error("Pick at least one origin airport");
      return;
    }
    if (destinations.length === 0) {
      toast.error("Pick at least one destination country");
      return;
    }
    if (!occupantsMatch) {
      toast.error(
        `Room occupants (${occupantsAdults}A/${occupantsChildren}C) must equal passenger counts (${totalAdults}A/${totalChildren}C)`,
      );
      return;
    }
    if (minDays > maxDays) {
      toast.error("Min days must be ≤ max days");
      return;
    }
    if (dateEnd < dateStart) {
      toast.error("End date must be after start date");
      return;
    }

    const passengers = [
      ...Array.from({ length: adults }, () => ({ type: "adult" as const })),
      ...children.map((c) => ({ type: classifyAge(c.age), age: c.age })),
    ];

    const payload = {
      origins,
      destinationCountries: destinations,
      dateWindowStart: dateStart,
      dateWindowEnd: dateEnd,
      minDays,
      maxDays,
      passengers,
      rooms: { rooms },
      filters: {
        pool: pool || undefined,
        maxDistanceToBeachMeters:
          typeof maxBeach === "number" ? maxBeach : undefined,
        allInclusive: allInclusive || undefined,
        minHotelRating: typeof minRating === "number" ? minRating : undefined,
        maxBudgetTotal: typeof maxBudget === "number" ? maxBudget : undefined,
      },
      currency,
      label: label.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as
        | { ok: true; searchId: string }
        | { ok: false; error: string; issues?: unknown };
      if (!res.ok || !("ok" in data) || !data.ok) {
        const msg = "error" in data ? data.error : "Failed to start search";
        toast.error(msg);
        setSubmitting(false);
        return;
      }
      router.push(`/searches/${data.searchId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Where & when</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Origin airports</Label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_ORIGINS.map((o) => (
                <button
                  key={o.iata}
                  type="button"
                  onClick={() => toggleArray(origins, setOrigins, o.iata)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    origins.includes(o.iata)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent"
                  }`}
                >
                  {o.iata} · {o.city}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Destination countries</Label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() =>
                    toggleArray(destinations, setDestinations, c.code)
                  }
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    destinations.includes(c.code)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date-start">Earliest departure</Label>
              <Input
                id="date-start"
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-end">Latest return</Label>
              <Input
                id="date-end"
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-days">Minimum nights</Label>
              <NumberInput
                id="min-days"
                min={1}
                max={60}
                value={minDays}
                onValueChange={setMinDays}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-days">Maximum nights</Label>
              <NumberInput
                id="max-days"
                min={1}
                max={60}
                value={maxDays}
                onValueChange={setMaxDays}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Travellers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="adults">Adults (16+)</Label>
              <NumberInput
                id="adults"
                min={1}
                max={9}
                value={adults}
                onValueChange={setAdults}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Children</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addChild}
                >
                  <Plus className="size-3" /> Add child
                </Button>
              </div>
              {children.length === 0 ? (
                <p className="text-sm text-muted-foreground">No children.</p>
              ) : (
                <div className="space-y-2">
                  {children.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <NumberInput
                        min={0}
                        max={17}
                        value={c.age}
                        onValueChange={(age) =>
                          setChildren((cs) =>
                            cs.map((x) =>
                              x.id === c.id ? { ...x, age } : x,
                            ),
                          )
                        }
                        className="w-32 shrink-0"
                      />
                      <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">
                        years → {classifyAge(c.age)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeChild(c.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Rooms</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRoom}
              >
                <Plus className="size-3" /> Add room
              </Button>
            </div>
            {rooms.map((r, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_1fr_auto] items-end gap-3"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Adults</Label>
                  <NumberInput
                    min={1}
                    max={6}
                    value={r.adults}
                    onValueChange={(adults) =>
                      setRooms((rs) =>
                        rs.map((x, i) =>
                          i === idx ? { ...x, adults } : x,
                        ),
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Children</Label>
                  <NumberInput
                    min={0}
                    max={6}
                    value={r.children}
                    onValueChange={(c) =>
                      setRooms((rs) =>
                        rs.map((x, i) =>
                          i === idx
                            ? { ...x, children: c }
                            : x,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={rooms.length === 1}
                  onClick={() => removeRoom(idx)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {!occupantsMatch && (
              <p className="text-sm text-destructive">
                Rooms hold {occupantsAdults} adults / {occupantsChildren}{" "}
                children, but you have {totalAdults} / {totalChildren}.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Label className="flex items-center gap-2">
              <Checkbox
                checked={pool}
                onCheckedChange={(v) => setPool(v)}
              />
              <span>Hotel must have a pool</span>
            </Label>
            <Label className="flex items-center gap-2">
              <Checkbox
                checked={allInclusive}
                onCheckedChange={(v) => setAllInclusive(v)}
              />
              <span>All-inclusive only</span>
            </Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="beach">Max distance to beach (m)</Label>
              <Input
                id="beach"
                type="number"
                min={0}
                step={50}
                value={maxBeach}
                onChange={(e) =>
                  setMaxBeach(
                    e.target.value === ""
                      ? ""
                      : parseInt(e.target.value, 10) || 0,
                  )
                }
                placeholder="any"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rating">Min hotel rating (0-10)</Label>
              <Input
                id="rating"
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={minRating}
                onChange={(e) =>
                  setMinRating(
                    e.target.value === "" ? "" : parseFloat(e.target.value),
                  )
                }
                placeholder="any"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Max total budget</Label>
              <Input
                id="budget"
                type="number"
                min={0}
                step={50}
                value={maxBudget}
                onChange={(e) =>
                  setMaxBudget(
                    e.target.value === ""
                      ? ""
                      : parseInt(e.target.value, 10) || 0,
                  )
                }
                placeholder="any"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as typeof currency)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="RON">RON — Romanian leu</SelectItem>
                  <SelectItem value="USD">USD — US dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Nickname (optional)</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Family summer 2026"
                maxLength={80}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Saving…" : "Find vacations"}
        </Button>
      </div>
    </form>
  );
}
