type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, string | number | boolean | null | undefined>;

const SAFE_REASON = /^[A-Za-z][A-Za-z0-9_]{1,47}$/;

/**
 * Code court d'une erreur réseau (`ConnectionRefused`, `TimeoutError`…), seul
 * détail d'erreur publiable : un message peut contenir une URL ou une clé.
 */
export function errorReason(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const { code, name, cause } = current as { code?: unknown; name?: unknown; cause?: unknown };
    if (typeof code === "string" && SAFE_REASON.test(code)) return code;
    if (typeof name === "string" && name !== "Error" && SAFE_REASON.test(name)) return name;
    current = cause;
  }
  return undefined;
}

/** Call sites pass counts, states, durations and `errorReason` codes only, never requests or error messages. */
export function logEvent(level: LogLevel, event: string, fields: LogFields = {}): void {
  const details = Object.entries(fields).filter(([, value]) => value != null)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ");
  const line = `${new Date().toISOString()} ${level.toUpperCase()} [benchsift] ${event}${details ? ` ${details}` : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
