import { Link } from "@/components/link";
import { cn } from "@/lib/utils";

export interface PillLink {
  href: string;
  label: string;
  /** A way out of the list (all models, the comparator), drawn as a plain link. */
  secondary?: boolean;
}

/** A titled row of internal links to related pages, at the end of a page. */
export function LinkPills({ id, title, links, className }: { id: string; title: string; links: PillLink[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <nav aria-labelledby={id} className={cn("mt-10 border-t pt-6", className)}>
      <h2 id={id} className="text-base font-semibold">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={cn(
                "inline-flex min-h-10 items-center rounded-lg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                link.secondary ? "font-medium text-primary underline-offset-4 hover:underline" : "border bg-card hover:bg-muted",
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
