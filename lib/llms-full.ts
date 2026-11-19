/*
 * /llms-full.txt: the indexed models with their sourced key figures, in plain
 * Markdown for language models. A value no source publishes is left out of
 * its line, never filled in.
 */
import type { LLMModel } from "@/lib/model-types";
import { getIndexableCatalogModels } from "@/lib/model-catalog";
import { isOpenWeightsModel, textMetricValue } from "@/lib/model-metrics";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";

const finite = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const number = (value: number, digits = 1) => value.toLocaleString("en-US", { maximumFractionDigits: digits });
const price = (value: number) => `$${value.toLocaleString("en-US", { maximumSignificantDigits: 3 })}`;
// Square brackets would close the Markdown link text early.
const linkText = (text: string) => text.replace(/[[\]]/g, (char) => `\\${char}`);

/** One Markdown line per model: link, creator, then each published figure. */
export function modelLine(model: LLMModel, rank: number, total: number): string {
  const facts = [model.model_creator.name];
  const intelligence = textMetricValue(model, "artificial_analysis_intelligence_index");
  if (intelligence !== null) facts.push(`Intelligence Index ${number(intelligence)} (${rank} of ${total} listed)`);
  const coding = textMetricValue(model, "artificial_analysis_coding_index");
  if (coding !== null) facts.push(`Coding Index ${number(coding)}`);
  const blended = finite(model.pricing.price_1m_blended_3_to_1);
  if (blended !== null) facts.push(`${price(blended)} per 1M tokens (3:1 blended)`);
  const speed = finite(model.median_output_tokens_per_second);
  if (speed !== null && speed > 0) facts.push(`${number(speed)} output tokens/s`);
  const context = finite(model.context_window_tokens);
  if (context !== null && context > 0) facts.push(`${number(context, 0)}-token context`);
  if (model.release_date && Number.isFinite(Date.parse(model.release_date))) facts.push(`released ${model.release_date.slice(0, 10)}`);
  if (isOpenWeightsModel(model)) facts.push("open weights");
  return `- [${linkText(model.name)}](${absoluteUrl(`/models/${encodeURIComponent(model.slug)}`)}): ${facts.join("; ")}`;
}

/** The whole document, best Intelligence Index first; `updatedAt` is the catalogue's refresh time. */
export function llmsFullTxt(models: LLMModel[], updatedAt: string | null): string {
  const listed = getIndexableCatalogModels(models)
    .map((model, index) => ({ model, index, score: textMetricValue(model, "artificial_analysis_intelligence_index") ?? -Infinity }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ model }) => model);
  const header = [
    `# ${SITE_NAME}: AI models and their key figures`,
    "",
    `> The models with a page indexed on ${SITE_NAME}, best Artificial Analysis Intelligence Index first. Each figure comes from Artificial Analysis, OpenRouter, Models.dev or Hugging Face; a figure no source publishes is left out. Ranks count only the models listed here. Each model page has the full benchmarks, prices, speed and capabilities, and a French version under ${absoluteUrl("/fr/models/{slug}")}.`,
    "",
    ...(updatedAt ? [`Catalogue refreshed: ${updatedAt}`, ""] : []),
    "## Models",
    "",
    "",
  ].join("\n");
  if (listed.length === 0) return `${header}The catalogue is unavailable right now.\n`;
  return `${header}${listed.map((model, index) => modelLine(model, index + 1, listed.length)).join("\n")}\n`;
}
