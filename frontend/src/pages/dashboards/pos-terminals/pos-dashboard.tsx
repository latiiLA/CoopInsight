import { type ComponentType, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  Building2,
  MapPin,
  Pause,
  Store,
  Terminal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPosTerminals } from "@/features/pos_terminal_slice";
import { cn } from "@/lib/utils";
import { AppDispatch, RootState } from "../../../../app/store/store";
import {
  SITE_BRANCH,
  SITE_MERCHANT,
  TO_BE_RELOCATED,
  countBy,
  countWhere,
  districtMix,
  formatCount,
  isInactiveStatus,
  liveTerminals,
  posTerminalsPath,
  stackedDistrictRows,
  uniqueMerchantCount,
  withOthers,
} from "./pos-fleet";
import {
  FleetPie,
  FleetRankList,
  FleetStackedBar,
} from "../atm-terminals/atm-dashboard-charts";
import { PosDistrictMixTable } from "./pos-district-table";

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  loading: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "gap-3 py-4",
        onClick && "cursor-pointer transition-colors hover:bg-muted/40",
      )}
      onClick={onClick}
    >
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-3">
          <CardDescription>{label}</CardDescription>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        )}
      </CardHeader>
      <CardContent className="px-4 text-sm text-muted-foreground">
        {loading ? <Skeleton className="h-4 w-28" /> : hint}
      </CardContent>
    </Card>
  );
}

const PosDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { terminals, loading, error } = useSelector(
    (state: RootState) => state.posTerminal,
  );
  const { authUser } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    if (authUser) {
      dispatch(fetchPosTerminals());
    }
  }, [authUser, dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const live = useMemo(() => liveTerminals(terminals), [terminals]);
  const inactive = useMemo(
    () => terminals.filter((terminal) => isInactiveStatus(terminal.status)),
    [terminals],
  );

  const inactiveStatusSlices = useMemo(
    () => countBy(inactive, (terminal) => terminal.status),
    [inactive],
  );
  const allStatusSlices = useMemo(
    () => countBy(terminals, (terminal) => terminal.status),
    [terminals],
  );
  const siteSlices = useMemo(
    () => countBy(live, (terminal) => terminal.site),
    [live],
  );
  const businessTypeSlices = useMemo(
    () => withOthers(countBy(live, (terminal) => terminal.businessType), 10),
    [live],
  );
  const mix = useMemo(() => districtMix(terminals), [terminals]);
  const stackedRows = useMemo(() => stackedDistrictRows(mix, 16), [mix]);
  const rankedBranches = useMemo(
    () => countBy(live, (terminal) => terminal.branchName),
    [live],
  );
  const branchSlices = rankedBranches.slice(0, 10);
  const rankedMerchants = useMemo(
    () => countBy(live, (terminal) => terminal.merchantName),
    [live],
  );
  const merchantSlices = rankedMerchants.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">POS Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live POS fleet from TMS. Merchant sites are at the customer; branch sites sit in a Coop branch. Stopped and relocated terminals are no longer operating.
          </p>
        </div>
        <Button onClick={() => navigate(posTerminalsPath())}>
          View all terminals
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total POS"
          value={formatCount(live.length)}
          hint="Live fleet"
          icon={Activity}
          loading={loading}
          onClick={() => navigate(posTerminalsPath())}
        />
        <MetricCard
          label="Active"
          value={formatCount(countWhere(terminals, "status", "Active"))}
          hint="In service"
          icon={Terminal}
          loading={loading}
          onClick={() => navigate(posTerminalsPath({ status: "Active" }))}
        />
        <MetricCard
          label="New"
          value={formatCount(countWhere(terminals, "status", "New"))}
          hint="Not yet in service"
          icon={Store}
          loading={loading}
          onClick={() => navigate(posTerminalsPath({ status: "New" }))}
        />
        <MetricCard
          label="Stopped"
          value={formatCount(countWhere(terminals, "status", "Stopped"))}
          hint="No longer operating"
          icon={Pause}
          loading={loading}
          onClick={() => navigate(posTerminalsPath({ status: "Stopped" }))}
        />
        <MetricCard
          label="Relocated"
          value={formatCount(countWhere(terminals, "status", "Relocated"))}
          hint="Moved off this site"
          icon={MapPin}
          loading={loading}
          onClick={() => navigate(posTerminalsPath({ status: "Relocated" }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="To be relocated"
          value={formatCount(countWhere(terminals, "status", TO_BE_RELOCATED))}
          hint="Live, pending a move"
          icon={MapPin}
          loading={loading}
          onClick={() => navigate(posTerminalsPath({ status: TO_BE_RELOCATED }))}
        />
        <MetricCard
          label="Merchant"
          value={formatCount(countWhere(terminals, "site", SITE_MERCHANT))}
          hint="At the merchant"
          icon={Store}
          loading={loading}
          onClick={() => navigate(posTerminalsPath({ site: SITE_MERCHANT }))}
        />
        <MetricCard
          label="Branch"
          value={formatCount(countWhere(terminals, "site", SITE_BRANCH))}
          hint="In a Coop branch"
          icon={Building2}
          loading={loading}
          onClick={() => navigate(posTerminalsPath({ site: SITE_BRANCH }))}
        />
        <MetricCard
          label="Merchants"
          value={formatCount(uniqueMerchantCount(terminals))}
          hint="Unique live merchant IDs"
          icon={Store}
          loading={loading}
          onClick={() => navigate(posTerminalsPath())}
        />
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <FleetPie
          title="All statuses"
          description="Active, new, to-be-relocated, stopped, and relocated"
          rows={allStatusSlices}
          total={terminals.length}
          loading={loading}
          onSelect={(status) => navigate(posTerminalsPath({ status }))}
        />
        <FleetPie
          title="Site mix"
          description="Live fleet, merchant vs branch"
          rows={siteSlices}
          total={live.length}
          loading={loading}
          onSelect={(site) => navigate(posTerminalsPath({ site }))}
        />
        <FleetPie
          title="Business type"
          description="Live fleet by TMS business type"
          rows={businessTypeSlices}
          total={live.length}
          loading={loading}
          onSelect={(businessType) =>
            navigate(posTerminalsPath({ businessType }))
          }
        />
        <FleetPie
          title="Stopped and relocated"
          description="Taken off site or no longer operating"
          rows={inactiveStatusSlices}
          total={inactive.length}
          loading={loading}
          onSelect={(status) => navigate(posTerminalsPath({ status }))}
        />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <FleetStackedBar
          title="Live POS by district"
          description="Merchant vs branch live fleet"
          rows={stackedRows}
          series={[
            { key: SITE_MERCHANT, color: "var(--chart-1)" },
            { key: SITE_BRANCH, color: "var(--chart-2)" },
          ]}
          loading={loading}
          onSelect={(district) => navigate(posTerminalsPath({ district }))}
        />
        <FleetRankList
          title="Top branches"
          description={`Largest live POS counts, relative to the top branch. Showing ${formatCount(branchSlices.length)} of ${formatCount(rankedBranches.length)}.`}
          rows={branchSlices}
          loading={loading}
          onSelect={(branch) => navigate(posTerminalsPath({ branch }))}
        />
      </div>

      <FleetRankList
        title="Top merchants"
        description={`Merchants with the most live POS terminals. Showing ${formatCount(merchantSlices.length)} of ${formatCount(rankedMerchants.length)}.`}
        rows={merchantSlices}
        loading={loading}
        onSelect={(merchant) => navigate(posTerminalsPath({ merchant }))}
      />

      <PosDistrictMixTable
        rows={mix}
        loading={loading}
        onOpen={(filters) => navigate(posTerminalsPath(filters))}
      />
    </div>
  );
};

export default PosDashboard;
