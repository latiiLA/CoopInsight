import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  MapPin,
  Monitor,
  Pause,
  Terminal,
} from "lucide-react";

import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { fetchAtmTerminals } from "@/features/atm_terminal_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { FleetChangeCard } from "../fleet-change-card";
import {
  atmTerminalsPath,
  countBy,
  countWhere,
  districtMix,
  formatCount,
  isInactiveStatus,
  liveTerminals,
  stackedDistrictRows,
} from "./atm-fleet";
import { FleetPie, FleetRankList, FleetStackedBar } from "./atm-dashboard-charts";
import { DistrictMixTable } from "./atm-district-table";

const AtmDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { terminals, loading, error } = useSelector(
    (state: RootState) => state.atmTerminal,
  );
  const { authUser } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    if (authUser) {
      dispatch(fetchAtmTerminals());
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
  const typeSlices = useMemo(
    () => countBy(live, (terminal) => terminal.type),
    [live],
  );
  const mix = useMemo(() => districtMix(terminals), [terminals]);
  const [stackMode, setStackMode] = useState<"site" | "type">("site");
  const stackedRows = useMemo(
    () => stackedDistrictRows(mix, stackMode, 16),
    [mix, stackMode],
  );
  const rankedBranches = useMemo(
    () => countBy(live, (terminal) => terminal.branchName),
    [live],
  );
  const branchSlices = rankedBranches.slice(0, 10);

  return (
    <div className="container mx-auto min-w-0 space-y-4 pb-6">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">ATM Dashboard</h3>
          <p className="text-sm text-muted-foreground">
            Live ATM fleet from TMS. Stopped and relocated terminals were taken
            to another branch or are no longer operating.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => navigate(atmTerminalsPath())}
        >
          View all terminals
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <FleetChangeCard
        terminals={terminals}
        loading={loading}
        label="New + Active ATMs"
        icon={Activity}
        onClick={() => navigate(atmTerminalsPath())}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,5fr)_minmax(0,2fr)_minmax(0,2fr)]">
        <section className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold tracking-tight">Status</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <MetricCard
              compact
              label="Total ATMs"
              value={formatCount(live.length)}
              icon={Activity}
              loading={loading}
              onClick={() => navigate(atmTerminalsPath())}
            />
            <MetricCard
              compact
              label="Active"
              value={formatCount(countWhere(terminals, "status", "Active"))}
              icon={Monitor}
              loading={loading}
              onClick={() => navigate(atmTerminalsPath({ status: "Active" }))}
            />
            <MetricCard
              compact
              label="Stopped"
              value={formatCount(countWhere(terminals, "status", "Stopped"))}
              icon={Pause}
              loading={loading}
              onClick={() => navigate(atmTerminalsPath({ status: "Stopped" }))}
            />
            <MetricCard
              compact
              label="New"
              value={formatCount(countWhere(terminals, "status", "New"))}
              icon={Terminal}
              loading={loading}
              onClick={() => navigate(atmTerminalsPath({ status: "New" }))}
            />
            <MetricCard
              compact
              label="Relocated"
              value={formatCount(countWhere(terminals, "status", "Relocated"))}
              icon={MapPin}
              loading={loading}
              onClick={() =>
                navigate(atmTerminalsPath({ status: "Relocated" }))
              }
            />
          </div>
        </section>

        <section className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold tracking-tight">Site</h4>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              compact
              label="Onsite"
              value={formatCount(countWhere(terminals, "site", "Onsite"))}
              icon={MapPin}
              loading={loading}
              onClick={() => navigate(atmTerminalsPath({ site: "Onsite" }))}
            />
            <MetricCard
              compact
              label="Offsite"
              value={formatCount(countWhere(terminals, "site", "Offsite"))}
              icon={MapPin}
              loading={loading}
              onClick={() => navigate(atmTerminalsPath({ site: "Offsite" }))}
            />
          </div>
        </section>

        <section className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold tracking-tight">Type</h4>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              compact
              label="CRM"
              value={formatCount(countWhere(terminals, "type", "CRM"))}
              icon={Monitor}
              loading={loading}
              onClick={() => navigate(atmTerminalsPath({ type: "CRM" }))}
            />
            <MetricCard
              compact
              label="NCR"
              value={formatCount(countWhere(terminals, "type", "NCR"))}
              icon={Monitor}
              loading={loading}
              onClick={() => navigate(atmTerminalsPath({ type: "NCR" }))}
            />
          </div>
        </section>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FleetPie
          title="All statuses"
          description="Active, new, stopped, and relocated"
          rows={allStatusSlices}
          total={terminals.length}
          loading={loading}
          onSelect={(status) => navigate(atmTerminalsPath({ status }))}
        />
        <FleetPie
          title="Site mix"
          description="Live fleet, onsite vs offsite"
          rows={siteSlices}
          total={live.length}
          loading={loading}
          onSelect={(site) => navigate(atmTerminalsPath({ site }))}
        />
        <FleetPie
          title="Type mix"
          description="Live fleet, CRM vs NCR"
          rows={typeSlices}
          total={live.length}
          loading={loading}
          onSelect={(type) => navigate(atmTerminalsPath({ type }))}
        />
        <FleetPie
          title="Stopped and relocated"
          description="Taken to another branch or no longer operating"
          rows={inactiveStatusSlices}
          total={inactive.length}
          loading={loading}
          onSelect={(status) => navigate(atmTerminalsPath({ status }))}
        />
      </div>

      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <FleetStackedBar
          title="Live ATMs by district"
          description={
            stackMode === "site"
              ? "Onsite vs offsite live fleet"
              : "CRM vs NCR live fleet"
          }
          rows={stackedRows}
          series={
            stackMode === "site"
              ? [
                  { key: "Onsite", color: "var(--chart-1)" },
                  { key: "Offsite", color: "var(--chart-2)" },
                ]
              : [
                  { key: "CRM", color: "var(--chart-3)" },
                  { key: "NCR", color: "var(--color-primary)" },
                ]
          }
          loading={loading}
          onSelect={(district) => navigate(atmTerminalsPath({ district }))}
          actions={
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={stackMode === "site" ? "default" : "outline"}
                onClick={() => setStackMode("site")}
              >
                Site
              </Button>
              <Button
                type="button"
                size="sm"
                variant={stackMode === "type" ? "default" : "outline"}
                onClick={() => setStackMode("type")}
              >
                Type
              </Button>
            </div>
          }
        />
        <FleetRankList
          title="Top branches"
          description={`Largest live ATM counts, relative to the top branch. Showing ${formatCount(branchSlices.length)} of ${formatCount(rankedBranches.length)}.`}
          rows={branchSlices}
          loading={loading}
          onSelect={(branch) => navigate(atmTerminalsPath({ branch }))}
        />
      </div>

      <DistrictMixTable
        rows={mix}
        loading={loading}
        onOpen={(filters) => navigate(atmTerminalsPath(filters))}
      />
    </div>
  );
};

export default AtmDashboard;
