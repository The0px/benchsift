import { useCallback } from "react";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { fetchCreatorProfile } from "@/lib/server-fns";
import { parseCreatorSearch, type CreatorSearch } from "@/lib/creator-profile";
import { CreatorProfileView } from "@/components/creator/creator-profile-view";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { translationsFor } from "@/lib/i18n";
import { breadcrumbJsonLd, localizedUrl, seo } from "@/lib/seo";

const NOINDEX = "noindex, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

export const Route = createFileRoute("/creators/$slug")({
  validateSearch: parseCreatorSearch,
  // The sort lives in the URL; changing it must not refetch the profile.
  shouldReload: ({ cause }) => cause !== "stay",
  loader: async ({ params }) => {
    const profile = await fetchCreatorProfile({ data: params.slug });
    if (!profile) throw notFound();
    // Source spellings of the creator (x-ai, aws, qwen…) move to the profile's own address.
    if (params.slug !== profile.slug) throw redirect({
      to: "/creators/$slug", params: { slug: profile.slug }, statusCode: 301,
    });
    return profile;
  },
  head: ({ match, loaderData }) => {
    if (!loaderData) return {};
    const lang = match.context.lang;
    const t = translationsFor(lang);
    const path = `/creators/${loaderData.slug}`;
    const leader = loaderData.best.find((best) => best.metric === "artificial_analysis_intelligence_index")?.name ?? null;
    const description = t.seo.creator.description(loaderData.name, loaderData.modelCount, leader);
    return seo({
      title: t.seo.creator.title(loaderData.name),
      description,
      lang,
      path,
      // Indexed only when one of its models has an indexed page of its own.
      robots: loaderData.indexableCount > 0 ? undefined : NOINDEX,
      jsonLd: [
        breadcrumbJsonLd(lang, [
          { name: t.seo.breadcrumb.home, path: "/" },
          { name: loaderData.name, path },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: localizedUrl(path, lang),
          inLanguage: lang,
          description,
          dateModified: loaderData.updatedAt ?? undefined,
          mainEntity: {
            "@type": "Organization",
            name: loaderData.name,
            sameAs: loaderData.huggingFace?.organizations.map((organization) => organization.url),
          },
        },
      ],
    });
  },
  component: CreatorPage,
});

function CreatorPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const updateSearch = useCallback(
    (next: CreatorSearch) => void navigate({ search: next, replace: true, resetScroll: false }),
    [navigate],
  );
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader backHref="/" />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <CreatorProfileView data={data} search={search} onSearchChange={updateSearch} />
      </main>
      <SiteFooter />
    </div>
  );
}
