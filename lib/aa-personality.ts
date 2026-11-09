import "@tanstack/react-start/server-only";

import { fetchWithRetry } from "./fetch-with-retry";
import { cached } from "@/lib/revalidate-cache";
import { parsePersonality, type PersonalityData } from "./aa-personality-data";
export type { PersonalityData, PersonalityRow } from "./aa-personality-data";

const PERSONALITY_URL = "https://artificialanalysis.ai/evaluations/aa-personalitybench";
const FETCH_TIMEOUT_MS = 8_000;
const CACHE_SECONDS = 21_600; // 6h

const EMPTY: PersonalityData = { rows: [], traits: [], indexes: [] };

const getPersonalityDataCached = cached(
  async (): Promise<PersonalityData> => {
    const res = await fetchWithRetry(
      PERSONALITY_URL,
      {
        headers: {
          RSC: "1",
          Accept: "text/x-component, */*",
          "User-Agent": "BenchSift/1.0 (+https://benchsift.nxtaigen.com)",
        },
      },
      { timeoutMs: FETCH_TIMEOUT_MS, maxAttempts: 2 },
    );
    if (!res.ok) throw new Error("AA-PersonalityBench source unavailable");
    const data = parsePersonality(await res.text());
    if (!data.rows.length || !data.traits.length) throw new Error("AA-PersonalityBench source unavailable");
    return { ...data, fetched_at: new Date().toISOString() };
  },
  ["aa-personalitybench-data"],
  { revalidate: CACHE_SECONDS },
);

let retryAt = 0;
export async function getPersonalityData(): Promise<PersonalityData> {
  if (Date.now() < retryAt) return EMPTY;
  try {
    return await getPersonalityDataCached();
  } catch {
    retryAt = Date.now() + 30_000;
    return EMPTY;
  }
}
