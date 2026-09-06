import { type ComponentType, useEffect, useMemo, useState } from "react";
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

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAtmTerminals } from "@/features/atm_terminal_slice";
import { cn } from "@/lib/utils";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">ATM Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live ATM fleet from TMS. Stopped and relocated terminals were taken to another branch or are no longer operating.
          </p>
        </div>
        <Button onClick={() => navigate(atmTerminalsPath())}>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total ATMs"
          value={formatCount(live.length)}
          hint="Live fleet"
          icon={Activity}
          loading={loading}
          onClick={() => navigate(atmTerminalsPath())}
        />
        <MetricCard
          label="Active"
          value={formatCount(countWhere(terminals, "status", "Active"))}
          hint="In service"
          icon={Monitor}
          loading={loading}
          onClick={() => navigate(atmTerminalsPath({ status: "Active" }))}
        />
        <MetricCard
          label="Stopped"
          value={formatCount(countWhere(terminals, "status", "Stopped"))}
          hint="No longer operating"
          icon={Pause}
          loading={loading}
          onClick={() => navigate(atmTerminalsPath({ status: "Stopped" }))}
        />
        <MetricCard
          label="New"
          value={formatCount(countWhere(terminals, "status", "New"))}
          hint="Not yet in service"
          icon={Terminal}
          loading={loading}
          onClick={() => navigate(atmTerminalsPath({ status: "New" }))}
        />
        <MetricCard
          label="Relocated"
          value={formatCount(countWhere(terminals, "status", "Relocated"))}
          hint="Moved to another branch"
          icon={MapPin}
          loading={loading}
          onClick={() => navigate(atmTerminalsPath({ status: "Relocated" }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Onsite"
          value={formatCount(countWhere(terminals, "site", "Onsite"))}
          hint="Branch ATMs"
          icon={MapPin}
          loading={loading}
          onClick={() => navigate(atmTerminalsPath({ site: "Onsite" }))}
        />
        <MetricCard
          label="Offsite"
          value={formatCount(countWhere(terminals, "site", "Offsite"))}
          hint="Off-branch ATMs"
          icon={MapPin}
          loading={loading}
          onClick={() => navigate(atmTerminalsPath({ site: "Offsite" }))}
        />
        <MetricCard
          label="CRM"
          value={formatCount(countWhere(terminals, "type", "CRM"))}
          hint="Cash recycler"
          icon={Monitor}
          loading={loading}
          onClick={() => navigate(atmTerminalsPath({ type: "CRM" }))}
        />
        <MetricCard
          label="NCR"
          value={formatCount(countWhere(terminals, "type", "NCR"))}
          hint="NCR fleet"
          icon={Monitor}
          loading={loading}
          onClick={() => navigate(atmTerminalsPath({ type: "NCR" }))}
        />
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
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
