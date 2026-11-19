import { useEffect, useRef, useState } from "react";

const URL_QUERY_DELAY_MS = 300;

/**
 * A search box mirrored into the URL's `q` after a short pause, so typing does
 * not push a navigation per keystroke. An outside change of the URL (a link
 * back to the page) resets the box. `parse` rebuilds the full URL state.
 */
export function useUrlQuery<Search extends { q?: string }>(
  search: Search,
  onSearchChange: (search: Search) => void,
  parse: (raw: Record<string, unknown>) => Search,
): [string, (query: string) => void] {
  const [query, setQuery] = useState(search.q ?? "");
  const latestSearch = useRef(search);
  useEffect(() => {
    latestSearch.current = search;
  }, [search]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery((current) => (current.trim() === (search.q ?? "") ? current : search.q ?? ""));
  }, [search.q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = query.trim() || undefined;
      if (q !== latestSearch.current.q) onSearchChange(parse({ ...latestSearch.current, q }));
    }, URL_QUERY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, onSearchChange, parse]);
  return [query, setQuery];
}
