import { useMemo } from "react";

import { hasPermission } from "../../../utility/has-permission";
import CardActivityDashboard from "./card-activity-dashboard";
import { CardDetailSheet } from "./card-detail-sheet";

/** Permission that opens the card detail list at all. */
const CARD_DETAIL_PERMISSION = "card:view-card-details";

export default function CardActivityPage() {
  const canViewDetails = useMemo(
    () => hasPermission([CARD_DETAIL_PERMISSION]),
    [],
  );

  return (
    <CardActivityDashboard
      DetailSheet={canViewDetails ? CardDetailSheet : undefined}
    />
  );
}
