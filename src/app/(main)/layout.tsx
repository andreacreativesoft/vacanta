import Link from "next/link";
import { Plane } from "lucide-react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Plane className="size-5 text-primary" />
            <span>Vacanta</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground"
            >
              New search
            </Link>
            <Link
              href="/searches"
              className="text-muted-foreground hover:text-foreground"
            >
              History
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-muted-foreground">
          Personal use only · Built with Next.js, Drizzle, and Claude
        </div>
      </footer>
    </div>
  );
}
