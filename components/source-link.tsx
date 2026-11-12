import { ExternalLink } from "@/components/icons";

/** A small outbound badge to a model's or creator's page at a source. */
export function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ExternalLink aria-hidden="true" className="size-3" />
      {label}
    </a>
  );
}
