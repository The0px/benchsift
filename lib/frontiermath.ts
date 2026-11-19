import "@tanstack/react-start/server-only";

import { fetchWithRetry } from "./fetch-with-retry";
import { cached } from "@/lib/revalidate-cache";
import { readZipTextEntries } from "./zip-entries";
import {
  EPOCH_MODEL_METADATA_FILE,
  FRONTIERMATH_FILES,
  FRONTIERMATH_TIERS,
  parseEpochModelMetadata,
  parseFrontierMathCsv,
  type FrontierMathData,
} from "./frontiermath-data";
export type { FrontierMathData, FrontierMathRow, FrontierMathTier } from "./frontiermath-data";

/** Epoch AI's public benchmark archive (CC BY 4.0), the files behind its benchmarking hub. */
const EPOCH_BENCHMARK_ARCHIVE_URL = "https://epoch.ai/data/benchmark_data.zip";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const CACHE_SECONDS = 21_600; // 6h

const EMPTY: FrontierMathData = { tiers: { tiers_1_3: [], tier_4: [] } };

async function fetchFrontierMathData(): Promise<FrontierMathData> {
  const res = await fetchWithRetry(
    EPOCH_BENCHMARK_ARCHIVE_URL,
    { headers: { Accept: "application/zip", "User-Agent": "BenchSift/1.0 (+https://benchsift.nxtaigen.com)" } },
    { timeoutMs: FETCH_TIMEOUT_MS, maxAttempts: 2 },
  );
  if (!res.ok) throw new Error("FrontierMath source unavailable");
  const length = Number(res.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_ARCHIVE_BYTES) throw new Error("FrontierMath source unavailable");
  const archive = new Uint8Array(await res.arrayBuffer());
  if (archive.byteLength > MAX_ARCHIVE_BYTES) throw new Error("FrontierMath source unavailable");

  const files = readZipTextEntries(archive, [EPOCH_MODEL_METADATA_FILE, ...Object.values(FRONTIERMATH_FILES)]);
  const metadata = parseEpochModelMetadata(files.get(EPOCH_MODEL_METADATA_FILE) ?? "");
  const tiers = Object.fromEntries(
    FRONTIERMATH_TIERS.map((tier) => [tier, parseFrontierMathCsv(files.get(FRONTIERMATH_FILES[tier]) ?? "", metadata)]),
  ) as FrontierMathData["tiers"];
  if (!tiers.tiers_1_3.length && !tiers.tier_4.length) throw new Error("FrontierMath source unavailable");
  return { tiers, fetched_at: new Date().toISOString() };
}

const getFrontierMathDataCached = cached(fetchFrontierMathData, ["epoch-frontiermath-v2"], { revalidate: CACHE_SECONDS });

let retryAt = 0;
/** Never throws: an unavailable source yields empty tiers, retried after 30 s. */
export async function getFrontierMathData(): Promise<FrontierMathData> {
  if (Date.now() < retryAt) return EMPTY;
  try {
    return await getFrontierMathDataCached();
  } catch {
    retryAt = Date.now() + 30_000;
    return EMPTY;
  }
}
