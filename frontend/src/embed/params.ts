import { format, isValid, parseISO, startOfDay, subDays } from "date-fns";

export type SwitchFlow = "overall" | "onus" | "offus" | "issuing";
export type RangePreset = "today" | "yesterday" | "7d" | "30d" | "custom";
export type EmbedTheme = "light" | "dark" | "auto";
export type EmbedDashboard = "switch" | "card";
export type CardRangePreset = "today" | "7d" | "30d" | "90d" | "12m" | "ytd";

const CARD_PRESETS: CardRangePreset[] = ["today", "7d", "30d", "90d", "12m", "ytd"];

// Mirrors embedCardMaxRangeDays in the backend handler.
export const CARD_MAX_RANGE_DAYS = 367;

export const FLOWS: Array<{ key: SwitchFlow; label: string }> = [
  { key: "overall", label: "Overall" },
  { key: "onus", label: "On-us" },
  { key: "offus", label: "Off-us" },
  { key: "issuing", label: "Issuing" },
];

export const PRESETS: Array<{ key: Exclude<RangePreset, "custom">; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
];

// Mirrors embedMaxRangeDays in the backend handler.
export const MAX_RANGE_DAYS = 31;
const MIN_REFRESH_SECONDS = 15;

export const ISO_FORMAT = "yyyy-MM-dd";

export type EmbedParams = {
  apiKey: string;
  dashboard: EmbedDashboard;
  /** Card dashboard only: starting preset, unless a from/to range is given. */
  cardPreset: CardRangePreset;
  title: string;
  flows: SwitchFlow[];
  initialFlow: SwitchFlow;
  preset: RangePreset;
  from: string;
  to: string;
  refreshSeconds: number;
  theme: EmbedTheme;
  showControls: boolean;
  good: number;
  warn: number;
};

const isFlow = (value: string): value is SwitchFlow =>
  FLOWS.some((flow) => flow.key === value);

const isIsoDate = (value: string | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));

function readNumber(raw: string | null, fallback: number) {
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Options are read from the fragment first, then the query string. The
 * fragment is never sent to the server, so `#apiKey=...` keeps the key out of
 * nginx access logs. A key given as `?apiKey=` still works but is moved into
 * the fragment so it does not linger in history or get re-sent on reload.
 */
// Hand-typed panel URLs vary; all of these are treated as the embed key.
const API_KEY_ALIASES = new Set(["apikey", "api_key", "api-key", "key", "x-api-key"]);

const normalizeName = (name: string) =>
  API_KEY_ALIASES.has(name.toLowerCase()) ? "apiKey" : name;

// A nameless token this long is taken as the key itself ("#<key>" or
// "?<key>"). Some hosts, Grafana included, rewrite "#" to "?" in iframe src.
const MIN_BARE_KEY_LENGTH = 16;

const isBareKey = (name: string, value: string) =>
  value === "" && name.length >= MIN_BARE_KEY_LENGTH;

function parseInto(target: URLSearchParams, raw: string) {
  // Tolerate "#/?a=b", "#?a=b" and "#a=b".
  new URLSearchParams(raw.replace(/^[#/?]+/, "")).forEach((value, name) => {
    if (isBareKey(name, value)) {
      if (!target.get("apiKey")) target.set("apiKey", name.trim());
    } else if (value.trim() !== "") {
      target.set(normalizeName(name), value.trim());
    }
  });
}

const isKeyEntry = (name: string, value: string) =>
  normalizeName(name) === "apiKey" || isBareKey(name, value);

/**
 * Shape of the URL this page was opened with, values hidden, so a missing-key
 * message can show whether the host (e.g. Grafana) dropped the fragment.
 */
export function describeReceivedUrl(): string {
  const redact = (raw: string, sigil: string) => {
    const body = raw.replace(/^[#/?]+/, "");
    if (!body) return "";
    if (!body.includes("=")) return `${sigil}<${body.length} chars, no "=">`;
    const names = [...new URLSearchParams(body).keys()].map((name) => `${name}=…`);
    return `${sigil}${names.join("&")}`;
  };
  const search = redact(window.location.search, "?");
  const hash = redact(window.location.hash, "#");
  return `${window.location.pathname}${search}${hash || " (no #fragment)"}`;
}

function readSource(): URLSearchParams {
  const merged = new URLSearchParams();
  parseInto(merged, window.location.search);
  parseInto(merged, window.location.hash);

  // A key in the query string is moved into the fragment so it is not re-sent
  // to the server on reload or kept in history.
  const original = new URLSearchParams(window.location.search);
  const query = new URLSearchParams();
  let keyInQuery = false;
  original.forEach((value, name) => {
    if (isKeyEntry(name, value)) keyInQuery = true;
    else query.append(name, value);
  });
  if (keyInQuery) {
    const fromHash = new URLSearchParams();
    parseInto(fromHash, window.location.hash);
    fromHash.set("apiKey", merged.get("apiKey") ?? "");
    const search = query.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}#${fromHash.toString()}`,
    );
  }

  return merged;
}

export function readEmbedParams(): EmbedParams {
  const params = readSource();

  // One flow per panel by default, matching the dashboard's per-flow pages.
  // `flows=overall,onus,...` adds a switcher across the listed flows.
  const requestedFlow = (params.get("flow") ?? "").toLowerCase();
  const flows = (params.get("flows") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(isFlow);
  const visibleFlows: SwitchFlow[] =
    flows.length > 0 ? flows : [isFlow(requestedFlow) ? requestedFlow : "overall"];

  const initialFlow =
    isFlow(requestedFlow) && visibleFlows.includes(requestedFlow)
      ? requestedFlow
      : visibleFlows[0];

  const from = params.get("from");
  const to = params.get("to");
  const hasCustomRange = isIsoDate(from) && isIsoDate(to) && from <= to;
  const requestedPreset = params.get("range") as RangePreset | null;
  const preset: RangePreset = hasCustomRange
    ? "custom"
    : PRESETS.some((p) => p.key === requestedPreset)
      ? (requestedPreset as RangePreset)
      : "today";

  const refresh = readNumber(params.get("refresh"), 0);
  const theme = params.get("theme");
  const dashboard: EmbedDashboard =
    (params.get("dashboard") ?? "").toLowerCase() === "card" ? "card" : "switch";
  const cardPreset = (CARD_PRESETS as string[]).includes(requestedPreset ?? "")
    ? (requestedPreset as CardRangePreset)
    : "30d";

  return {
    apiKey: params.get("apiKey") ?? "",
    dashboard,
    cardPreset,
    title: params.get("title") ?? "Switch success rate",
    flows: visibleFlows,
    initialFlow,
    preset,
    from: hasCustomRange ? from : todayIso(),
    to: hasCustomRange ? to : todayIso(),
    refreshSeconds: refresh > 0 ? Math.max(MIN_REFRESH_SECONDS, refresh) : 0,
    theme: theme === "light" || theme === "dark" ? theme : "auto",
    showControls: params.get("controls") !== "0",
    good: readNumber(params.get("good"), 95),
    warn: readNumber(params.get("warn"), 85),
  };
}

export const todayIso = () => format(startOfDay(new Date()), ISO_FORMAT);

/**
 * Relative presets are resolved on every call rather than once at load, so a
 * "Today" panel left open on a wall display rolls over at midnight.
 */
export function resolveRange(
  preset: RangePreset,
  custom: { from: string; to: string },
): { from: string; to: string } {
  const today = startOfDay(new Date());
  const iso = (date: Date) => format(date, ISO_FORMAT);
  switch (preset) {
    case "today":
      return { from: iso(today), to: iso(today) };
    case "yesterday": {
      const day = subDays(today, 1);
      return { from: iso(day), to: iso(day) };
    }
    case "7d":
      return { from: iso(subDays(today, 6)), to: iso(today) };
    case "30d":
      return { from: iso(subDays(today, 29)), to: iso(today) };
    default:
      return custom;
  }
}
