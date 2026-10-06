import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { toApiDate } from "@/lib/report-range";
import { SuccessRateView } from "@/pages/reports/success-rate/success-rate-view";
import type { SuccessTransactionReport } from "@/types/report";

import { EmbedErrorBanner } from "./error-banner";
import { EmbedError, getEmbedJson, MISSING_KEY_ERROR } from "./errors";
import {
  FLOWS,
  ISO_FORMAT,
  MAX_RANGE_DAYS,
  resolveRange,
  type EmbedParams,
  type RangePreset,
  type SwitchFlow,
} from "./params";
import { useTheme } from "./use-theme";

function fetchFlow(
  flow: SwitchFlow,
  apiKey: string,
  from: Date,
  to: Date,
  signal: AbortSignal,
): Promise<SuccessTransactionReport> {
  return getEmbedJson<SuccessTransactionReport>(
    `/switch/${flow}-success-rate`,
    apiKey,
    { dateFrom: toApiDate(from), dateTo: toApiDate(to) },
    signal,
  );
}

type CacheEntry = { report: SuccessTransactionReport; fetchedAt: Date };
const cacheKey = (flow: SwitchFlow, from: string, to: string) => `${flow}|${from}|${to}`;

/**
 * Grafana embed of the switch success-rate dashboard. Renders the same
 * SuccessRateView as the logged-in pages, so the panel is the dashboard; only
 * the data source (shared embed key instead of a user session) differs.
 */
export function EmbedApp({ params }: { params: EmbedParams }) {
  useTheme(params.theme);

  const [preset, setPreset] = useState<RangePreset>(params.preset);
  const [custom, setCustom] = useState({ from: params.from, to: params.to });
  const [active, setActive] = useState<SwitchFlow>(params.initialFlow);
  const [cache, setCache] = useState<Record<string, CacheEntry>>({});
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  // Keyed to the flow/range that failed, so a stale error never shows against
  // a different selection.
  const [failure, setFailure] = useState<{ key: string; error: EmbedError } | null>(null);

  const range = resolveRange(preset, custom);
  const key = cacheKey(active, range.from, range.to);
  const entry = cache[key];
  const error = !params.apiKey
    ? MISSING_KEY_ERROR
    : failure?.key === key
      ? failure.error
      : null;

  // One in-flight request at a time. Switching flow, moving the range or a
  // refresh tick aborts the previous query rather than letting a slow Oracle
  // response land after a newer one and overwrite it.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const load = useCallback(
    (flow: SwitchFlow, from: string, to: string) => {
      if (!params.apiKey) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      const requestKey = cacheKey(flow, from, to);
      fetchFlow(flow, params.apiKey, parseISO(from), parseISO(to), controller.signal)
        .then((report) => {
          if (controller.signal.aborted) return;
          setCache((prev) => ({
            ...prev,
            [requestKey]: { report, fetchedAt: new Date() },
          }));
          setFailure((prev) => (prev?.key === requestKey ? null : prev));
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setFailure({
            key: requestKey,
            error: err instanceof EmbedError ? err : new EmbedError(String(err)),
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    },
    [params.apiKey],
  );

  // Fetch on first view of a flow/range; revisiting a cached one is instant.
  // A failed fetch is not retried automatically, so a bad key cannot loop.
  const failedKey = failure?.key;
  useEffect(() => {
    if (entry || failedKey === key) return;
    load(active, range.from, range.to);
  }, [key, entry, failedKey, active, range.from, range.to, load]);

  // Grafana's dashboard refresh does not reach into an iframe, so the panel
  // refreshes itself. Skipped while the tab is hidden to spare Oracle.
  const latest = useRef({ preset, custom, active });
  latest.current = { preset, custom, active };
  useEffect(() => {
    if (!params.refreshSeconds || !params.apiKey) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const { preset: p, custom: c, active: a } = latest.current;
      const r = resolveRange(p, c);
      load(a, r.from, r.to);
    }, params.refreshSeconds * 1000);
    return () => window.clearInterval(id);
  }, [params.refreshSeconds, params.apiKey, load]);

  const retry = () => {
    setFailure(null);
    load(active, range.from, range.to);
  };

  const onDateChange = useCallback((date: DateRange | undefined) => {
    // Same as the dashboard: ignore the half-picked state mid-selection.
    if (!date?.from || !date?.to) return;
    let from = date.from;
    let to = date.to;
    if (differenceInCalendarDays(to, from) >= MAX_RANGE_DAYS) {
      to = addDays(from, MAX_RANGE_DAYS - 1);
      setNotice(`Embedded panels are limited to ${MAX_RANGE_DAYS} days; range shortened.`);
    } else {
      setNotice("");
    }
    setCustom({ from: format(from, ISO_FORMAT), to: format(to, ISO_FORMAT) });
    setPreset("custom");
  }, []);

  const dateRange: DateRange = { from: parseISO(range.from), to: parseISO(range.to) };
  const report = entry?.report ?? null;
  // Background refreshes keep the current numbers on screen instead of
  // flashing the skeleton.
  const showLoading = loading && !report && !error;

  const flowSwitcher =
    params.flows.length > 1 ? (
      <div className="flex rounded-md border p-0.5" role="tablist" aria-label="Flow">
        {FLOWS.filter((flow) => params.flows.includes(flow.key)).map(({ key: flowKey, label }) => (
          <Button
            key={flowKey}
            role="tab"
            aria-selected={active === flowKey}
            variant={active === flowKey ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2.5"
            onClick={() => setActive(flowKey)}
          >
            {label}
          </Button>
        ))}
      </div>
    ) : null;

  const updated =
    entry && params.refreshSeconds ? (
      <span className="text-xs tabular-nums text-muted-foreground">
        Updated {format(entry.fetchedAt, "HH:mm:ss")} · every {params.refreshSeconds}s
      </span>
    ) : null;

  return (
    <main className="min-h-svh bg-background p-4 text-foreground">
      {error ? (
        <EmbedErrorBanner
          error={error}
          hasData={!!report}
          onRetry={params.apiKey ? retry : undefined}
        />
      ) : null}

      {notice ? (
        <p className="container mx-auto mb-2 text-xs text-muted-foreground">{notice}</p>
      ) : null}

      <SuccessRateView
        channel="switch"
        flow={active}
        report={report}
        loading={showLoading}
        dateRange={dateRange}
        onDateChange={onDateChange}
        emptyMessage={error && !report ? error.message : undefined}
        headerActions={
          <>
            {updated}
            {flowSwitcher}
          </>
        }
      />
    </main>
  );
}
