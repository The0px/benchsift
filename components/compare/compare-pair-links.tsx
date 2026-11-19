import { LinkPills, type PillLink } from "@/components/link-pills";
import { comparePairPath, type ComparePair } from "@/lib/compare-pairs";
import { useI18n } from "@/lib/i18n";

/** Links to comparison pages, then optionally to the comparator itself. */
export function ComparePairLinks({ id, title, pairs, toComparator = false, className }: { id: string; title: string; pairs: ComparePair[]; toComparator?: boolean; className?: string }) {
  const { t } = useI18n();
  const links: PillLink[] = pairs.map((pair) => ({ href: comparePairPath(pair.a.slug, pair.b.slug), label: t.comparePair.heading(pair.a.name, pair.b.name) }));
  if (toComparator) links.push({ href: "/compare", label: t.comparePair.allCompare, secondary: true });
  return <LinkPills id={id} title={title} links={links} className={className} />;
}
