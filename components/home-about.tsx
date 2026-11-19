import { Link } from "@/components/link";
import { useI18n } from "@/lib/i18n";

/** What BenchSift is, who it serves and how it differs, under the home ranking. */
export function HomeAbout() {
  const { t } = useI18n();
  const copy = t.seoContent.homeAbout;
  const link = (href: string, label: string) => (
    <Link href={href} className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {label}
    </Link>
  );
  return (
    <section aria-labelledby="home-about" className="mt-10 border-t pt-6 sm:mt-12">
      <h2 id="home-about" className="text-base font-semibold tracking-tight">{copy.title}</h2>
      <div className="mt-3 max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground text-pretty">
        {copy.paragraphs(link).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
    </section>
  );
}
