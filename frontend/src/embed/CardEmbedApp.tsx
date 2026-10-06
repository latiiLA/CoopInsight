import { useEffect, useMemo, useState } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { parseISO } from "date-fns";
import { Provider, useSelector } from "react-redux";

import { Toaster } from "@/components/ui/sonner";
import cardActivityReducer, {
  type CardActivityClient,
  type CardActivityThunkExtra,
} from "@/features/card_activity_slice";
import CardActivityDashboard from "@/pages/card/card-activity-dashboard";

import { EmbedErrorBanner } from "./error-banner";
import { EmbedError, getEmbedJson, MISSING_KEY_ERROR } from "./errors";
import type { EmbedParams } from "./params";
import { useTheme } from "./use-theme";

function createCardStore(apiKey: string) {
  // The thunks unwrap `data` from the response envelope themselves.
  const cardActivityClient: CardActivityClient = async (path, params, signal) =>
    ({ data: await getEmbedJson(path, apiKey, params, signal) }) as never;

  const extra: CardActivityThunkExtra = { cardActivityClient };

  return configureStore({
    reducer: { cardActivity: cardActivityReducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: extra } }),
  });
}

type CardEmbedState = ReturnType<ReturnType<typeof createCardStore>["getState"]>;

function CardErrorBanner({ onRetry }: { onRetry: () => void }) {
  const { report, error, branchesError, branchTrendError } = useSelector(
    (state: CardEmbedState) => state.cardActivity,
  );
  const message = error ?? branchesError ?? branchTrendError;
  if (!message) return null;

  return (
    <EmbedErrorBanner
      error={new EmbedError(message, message === "Invalid embed key" ? 401 : undefined)}
      hasData={!!report}
      onRetry={onRetry}
    />
  );
}

/**
 * Grafana embed of the card activity dashboard. Renders the same dashboard
 * component as /card-activity against a store whose thunks call the
 * key-gated /api/embed/card routes. The card-level drill-down (customer data)
 * is not passed in, so it is unavailable here.
 */
export default function CardEmbedApp({ params }: { params: EmbedParams }) {
  useTheme(params.theme);

  const store = useMemo(() => createCardStore(params.apiKey), [params.apiKey]);
  // Remounting the dashboard re-runs every section's fetch.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!params.refreshSeconds || !params.apiKey) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setGeneration((n) => n + 1);
    }, params.refreshSeconds * 1000);
    return () => window.clearInterval(id);
  }, [params.refreshSeconds, params.apiKey]);

  const hasCustomRange = params.preset === "custom";
  const initialRange = useMemo(
    () =>
      hasCustomRange
        ? { from: parseISO(params.from), to: parseISO(params.to) }
        : undefined,
    [hasCustomRange, params.from, params.to],
  );

  return (
    <main className="min-h-svh bg-background p-4 text-foreground">
      {!params.apiKey ? (
        <EmbedErrorBanner error={MISSING_KEY_ERROR} hasData={false} />
      ) : (
        <Provider store={store}>
          <CardErrorBanner onRetry={() => setGeneration((n) => n + 1)} />
          <CardActivityDashboard
            key={generation}
            initialPreset={params.cardPreset}
            initialRange={initialRange}
          />
        </Provider>
      )}
      <Toaster theme={params.theme === "auto" ? "system" : params.theme} />
    </main>
  );
}
