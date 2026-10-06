import type { ComponentType } from "react";

import type { CardMetric } from "@/types/card-detail";

export type CardDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: CardMetric;
  dateFrom: string;
  dateTo: string;
  branchId?: number;
  /** Human-readable scope shown in the subtitle, e.g. a branch or day name. */
  scopeLabel?: string;
};

/**
 * The card dashboard takes the detail sheet as a component instead of
 * importing it, so the Grafana embed can render the dashboard without the
 * card-level list (customer data) or the session store it depends on.
 */
export type CardDetailSheetComponent = ComponentType<CardDetailSheetProps>;
