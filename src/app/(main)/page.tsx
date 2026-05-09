import { SearchForm } from "@/components/search-form";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Find a vacation
        </h1>
        <p className="text-muted-foreground">
          Pick your countries, dates, and crew — we&apos;ll find the 5 cheapest
          flight + hotel combos via Ryanair.
        </p>
      </div>
      <SearchForm />
    </div>
  );
}
