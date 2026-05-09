type Level = "debug" | "info" | "warn" | "error";

const ENABLED = process.env.NODE_ENV !== "production";

function emit(level: Level, scope: string, args: unknown[]) {
  if (level === "debug" && !ENABLED) return;
  const tag = `[${scope}]`;
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  fn(tag, ...args);
}

export function createLogger(scope: string) {
  return {
    debug: (...args: unknown[]) => emit("debug", scope, args),
    info: (...args: unknown[]) => emit("info", scope, args),
    warn: (...args: unknown[]) => emit("warn", scope, args),
    error: (...args: unknown[]) => emit("error", scope, args),
  };
}
