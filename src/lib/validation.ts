import { z } from "zod";

export const passengerSchema = z.object({
  type: z.enum(["adult", "teen", "child", "infant"]),
  age: z.number().int().min(0).max(99).optional(),
});

export const roomConfigSchema = z.object({
  rooms: z
    .array(
      z.object({
        adults: z.number().int().min(1).max(8),
        children: z.number().int().min(0).max(8),
      }),
    )
    .min(1)
    .max(4),
});

export const filtersSchema = z.object({
  pool: z.boolean().optional(),
  maxDistanceToBeachMeters: z.number().int().min(0).max(20000).optional(),
  allInclusive: z.boolean().optional(),
  minHotelRating: z.number().min(0).max(10).optional(),
  maxBudgetTotal: z.number().min(0).optional(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const searchInputSchema = z
  .object({
    origins: z.array(z.string().length(3)).min(1).max(5),
    destinationCountries: z
      .array(z.string().length(2))
      .min(1, "Pick at least one country")
      .max(8),
    dateWindowStart: isoDate,
    dateWindowEnd: isoDate,
    minDays: z.number().int().min(1).max(60),
    maxDays: z.number().int().min(1).max(60),
    passengers: z.array(passengerSchema).min(1).max(12),
    rooms: roomConfigSchema,
    filters: filtersSchema,
    currency: z.enum(["EUR", "RON", "USD"]),
    label: z.string().max(80).optional(),
  })
  .refine((v) => v.dateWindowEnd >= v.dateWindowStart, {
    message: "End date must be on or after start date",
    path: ["dateWindowEnd"],
  })
  .refine((v) => v.minDays <= v.maxDays, {
    message: "Min days must be ≤ max days",
    path: ["maxDays"],
  })
  .refine(
    (v) => {
      const totalAdults = v.rooms.rooms.reduce((s, r) => s + r.adults, 0);
      const totalChildren = v.rooms.rooms.reduce((s, r) => s + r.children, 0);
      const adults = v.passengers.filter((p) => p.type === "adult").length;
      const kids = v.passengers.filter((p) =>
        ["teen", "child", "infant"].includes(p.type),
      ).length;
      return totalAdults === adults && totalChildren === kids;
    },
    {
      message: "Room occupants must equal passenger counts",
      path: ["rooms"],
    },
  );

export type SearchInputParsed = z.infer<typeof searchInputSchema>;

export function classifyAge(age: number): "adult" | "teen" | "child" | "infant" {
  if (age >= 16) return "adult";
  if (age >= 12) return "teen";
  if (age >= 2) return "child";
  return "infant";
}
