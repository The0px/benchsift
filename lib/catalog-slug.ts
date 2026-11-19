/** Catalogue-style slug of a source name or id: lower case, hyphen-separated, ASCII. */
export function catalogSlug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
