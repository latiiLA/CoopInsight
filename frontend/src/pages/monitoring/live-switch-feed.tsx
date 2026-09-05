import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import config from "@/configs/config";
import { OnusEvent, OnusFrame } from "@/types/onus-monitoring";
import { getStoredAuthToken } from "@/utility/auth-token";

const MAX_EVENTS = 200;

type LiveSwitchFeedProps = {
  title: string;
  socketPath: string;
  emptyLabel: string;
};

function monitoringSocketUrl(socketPath: string, token: string) {
  const apiBase = config.API_URL.replace(/\/$/, "");
  const path = socketPath.startsWith("/") ? socketPath : `/${socketPath}`;

  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    const url = new URL(`${apiBase}${path}`);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", token);
    return url.toString();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${apiBase}${path}?token=${encodeURIComponent(token)}`;
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function LiveSwitchFeed({
  title,
  socketPath,
  emptyLabel,
}: LiveSwitchFeedProps) {
  const [events, setEvents] = useState<OnusEvent[]>([]);
  const [query, setQuery] = useState("");
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!config.LiveMonitoringEnabled) {
      setLive(false);
      setError("Live monitoring is disabled");
      return;
    }

    const token = getStoredAuthToken();
    if (!token) {
      setError("Authentication token not found");
      return;
    }

    seen.current = new Set();
    let stopped = false;
    let socket: WebSocket | undefined;
    let reconnect: number | undefined;

    const connect = () => {
      if (stopped) {
        return;
      }

      socket = new WebSocket(monitoringSocketUrl(socketPath, token));

      socket.onmessage = (message) => {
        let frame: OnusFrame;
        try {
          frame = JSON.parse(message.data) as OnusFrame;
        } catch {
          return;
        }

        if (frame.type === "status") {
          setLive(Boolean(frame.live));
          setError(frame.error || null);
          return;
        }

        if (frame.type !== "event" || !frame.event) {
          return;
        }

        const event = frame.event;
        const key = event.id || `${event.time}-${event.stan}-${event.terminal}`;
        if (seen.current.has(key)) {
          return;
        }
        seen.current.add(key);

        setLive(Boolean(frame.live));
        setError(frame.error || null);
        setEvents((current) => [event, ...current].slice(0, MAX_EVENTS));
      };

      socket.onerror = () => {
        setLive(false);
        setError("Live stream disconnected");
      };

      socket.onclose = () => {
        setLive(false);
        if (!stopped) {
          reconnect = window.setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      socket?.close();
      if (reconnect) {
        window.clearTimeout(reconnect);
      }
    };
  }, [socketPath]);

  const filteredEvents = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return events;
    }

    return events.filter((event) => {
      const haystack = [
        event.time,
        event.terminal,
        event.bankId,
        event.acquirer,
        event.type,
        event.processingCode,
        event.responseCode,
        event.stan,
        event.rrn,
        String(event.amount),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [events, query]);

  const approvedCount = useMemo(
    () => filteredEvents.filter((event) => event.approved).length,
    [filteredEvents],
  );
  const declinedCount = filteredEvents.length - approvedCount;

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between gap-3 py-0.5">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={
                live
                  ? "inline-block h-2 w-2 rounded-full bg-emerald-500"
                  : "inline-block h-2 w-2 rounded-full bg-muted-foreground/40"
              }
            />
            <span>
              {live
                ? "Live"
                : config.LiveMonitoringEnabled
                  ? "Connecting"
                  : "Disabled"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search terminal, bank, STAN..."
              className="h-7 pr-2 pl-7 text-xs"
            />
          </div>
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">
            Approved {approvedCount}
          </span>
          <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
            Declined {declinedCount}
          </span>
        </div>
      </div>

      {error ? (
        <div className="mt-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="mt-1 overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[7rem_7rem_7rem_1fr_7rem_6rem_7rem] gap-3 border-b bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span>Time</span>
          <span>Terminal</span>
          <span>Bank</span>
          <span>Transaction</span>
          <span className="text-right">Amount</span>
          <span>Response</span>
          <span>STAN</span>
        </div>
        <div className="max-h-[calc(100svh-7rem)] overflow-auto">
          {events.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {config.LiveMonitoringEnabled
                ? `Waiting for live ${emptyLabel} transactions...`
                : `Live ${emptyLabel} monitoring is disabled`}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No transactions match “{query.trim()}”
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div
                key={event.id || `${event.time}-${event.stan}`}
                className="grid grid-cols-[7rem_7rem_7rem_1fr_7rem_6rem_7rem] gap-3 border-b px-4 py-1.5 text-sm last:border-b-0"
              >
                <span className="tabular-nums text-muted-foreground">
                  {event.time.slice(-8) || event.time}
                </span>
                <span className="font-medium">{event.terminal || "—"}</span>
                <span className="tabular-nums text-muted-foreground">
                  {event.bankId || event.acquirer || "—"}
                </span>
                <span>{event.type || event.processingCode || "—"}</span>
                <span className="text-right tabular-nums">
                  {formatAmount(event.amount)}
                </span>
                <span>
                  <span
                    className={
                      event.approved
                        ? "rounded-md bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700"
                        : "rounded-md bg-destructive/15 px-2 py-0.5 font-medium text-destructive"
                    }
                  >
                    {event.responseCode}
                  </span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {event.stan || "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
