import "@tanstack/react-start/server-only";

import { fetchWithRetry } from "./fetch-with-retry";
import { cached } from "@/lib/revalidate-cache";
import { parseCursorBench, type CursorBenchData } from "./cursorbench-data";
export type { CursorBenchData, CursorBenchRow } from "./cursorbench-data";

const CURSORBENCH_URL = "https://cursor.com/cursorbench";
const FETCH_TIMEOUT_MS = 8_000;
const CACHE_SECONDS = 21_600; // 6h

const getCursorBenchDataCached = cached(
  async (): Promise<CursorBenchData> => {
    const res = await fetchWithRetry(
      CURSORBENCH_URL,
      { headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; BenchSift/1.0; +https://benchsift.nxtaigen.com)" } },
      { timeoutMs: FETCH_TIMEOUT_MS, maxAttempts: 2 },
    );
    if (!res.ok) throw new Error("CursorBench source unavailable");
    const data = parseCursorBench(await res.text());
    if (!data.rows.length) throw new Error("CursorBench source unavailable");
    return { ...data, fetched_at: new Date().toISOString() };
  },
  ["cursorbench-data"],
  { revalidate: CACHE_SECONDS },
);

let retryAt = 0;
/** Never throws: an unavailable source yields no rows, retried after 30 s. */
export async function getCursorBenchData(): Promise<CursorBenchData> {
  if (Date.now() < retryAt) return { rows: [], version: null };
  try {
    return await getCursorBenchDataCached();
  } catch {
    retryAt = Date.now() + 30_000;
    return { rows: [], version: null };
  }
}
