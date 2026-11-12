import { CreatorMark } from "@/components/creator-mark";
import { Link } from "@/components/link";
import { useI18n } from "@/lib/i18n";
import { creatorProfileHref } from "@/lib/provider-map";
import { cn } from "@/lib/utils";

/**
 * A creator's logo and name, linked to its profile. A stealth model, or a
 * creator without a profile, keeps plain text.
 */
export function CreatorName({
  slug,
  name,
  markSize,
  markClassName,
  className,
}: {
  slug: string;
  name: string;
  markSize?: number;
  markClassName?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const stealth = slug === "stealth";
  const label = stealth ? t.stealth.unknownCreator : name;
  const href = stealth ? null : creatorProfileHref(slug);
  const mark = <CreatorMark slug={slug} size={markSize} className={markClassName} />;
  if (!href) return <span className={className}>{mark}{label}</span>;
  return (
    <Link
      href={href}
      title={t.creator.profileLink(label)}
      className={cn(
        "rounded-sm underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {mark}{label}
    </Link>
  );
}
