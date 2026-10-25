import { useEffect, useMemo } from "react";
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

import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { fetchPosTerminals } from "@/features/pos_terminal_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { FleetChangeCard } from "../fleet-change-card";
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
    <div className="container mx-auto min-w-0 space-y-4 pb-6">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">POS Dashboard</h3>
          <p className="text-sm text-muted-foreground">
            Live POS fleet from TMS. Merchant sites are at the customer; branch
            sites sit in a Coop branch. Stopped and relocated terminals are no
            longer operating.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => navigate(posTerminalsPath())}
        >
          View all terminals
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <FleetChangeCard
        terminals={terminals}
        loading={loading}
        label="New + Active POS"
        icon={Activity}
        onClick={() => navigate(posTerminalsPath())}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,5fr)_minmax(0,2fr)_minmax(0,2fr)]">
        <section className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold tracking-tight">Status</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <MetricCard
              compact
              label="Total POS"
              value={formatCount(live.length)}
              icon={Activity}
              loading={loading}
              onClick={() => navigate(posTerminalsPath())}
            />
            <MetricCard
              compact
              label="Active"
              value={formatCount(countWhere(terminals, "status", "Active"))}
              icon={Terminal}
              loading={loading}
              onClick={() => navigate(posTerminalsPath({ status: "Active" }))}
            />
            <MetricCard
              compact
              label="New"
              value={formatCount(countWhere(terminals, "status", "New"))}
              icon={Store}
              loading={loading}
              onClick={() => navigate(posTerminalsPath({ status: "New" }))}
            />
            <MetricCard
              compact
              label="Stopped"
              value={formatCount(countWhere(terminals, "status", "Stopped"))}
              icon={Pause}
              loading={loading}
              onClick={() => navigate(posTerminalsPath({ status: "Stopped" }))}
            />
            <MetricCard
              compact
              label="Relocated"
              value={formatCount(countWhere(terminals, "status", "Relocated"))}
              icon={MapPin}
              loading={loading}
              onClick={() =>
                navigate(posTerminalsPath({ status: "Relocated" }))
              }
            />
          </div>
        </section>

        <section className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold tracking-tight">Site</h4>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              compact
              label="Merchant"
              value={formatCount(countWhere(terminals, "site", SITE_MERCHANT))}
              icon={Store}
              loading={loading}
              onClick={() => navigate(posTerminalsPath({ site: SITE_MERCHANT }))}
            />
            <MetricCard
              compact
              label="Branch"
              value={formatCount(countWhere(terminals, "site", SITE_BRANCH))}
              icon={Building2}
              loading={loading}
              onClick={() => navigate(posTerminalsPath({ site: SITE_BRANCH }))}
            />
          </div>
        </section>

        <section className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold tracking-tight">Other</h4>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              compact
              label="To relocate"
              value={formatCount(
                countWhere(terminals, "status", TO_BE_RELOCATED),
              )}
              icon={MapPin}
              loading={loading}
              onClick={() =>
                navigate(posTerminalsPath({ status: TO_BE_RELOCATED }))
              }
            />
            <MetricCard
              compact
              label="Merchants"
              value={formatCount(uniqueMerchantCount(terminals))}
              icon={Store}
              loading={loading}
              onClick={() => navigate(posTerminalsPath())}
            />
          </div>
        </section>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
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
