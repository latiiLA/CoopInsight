import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchPosTerminals } from "@/features/pos_terminal_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { columns } from "./columns";
import {
  ALL,
  PosTerminalFilters,
  emptyPosTerminalFilters,
  filtersFromSearchParams,
  matchesFilters,
  statusFilterOptions,
  uniqueSorted,
} from "./pos-fleet";

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function filtersToSearchParams(filters: PosTerminalFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== ALL) {
      params.set(key, value);
    }
  }

  return params;
}

const PosTerminals = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { terminals, loading, error } = useSelector(
    (state: RootState) => state.posTerminal,
  );
  const { authUser } = useSelector((state: RootState) => state.user);
  const filters = filtersFromSearchParams(searchParams);

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

  const statuses = useMemo(
    () => statusFilterOptions(terminals),
    [terminals],
  );
  const districts = useMemo(
    () => uniqueSorted(terminals.map((terminal) => terminal.districtName)),
    [terminals],
  );
  const branches = useMemo(
    () => uniqueSorted(terminals.map((terminal) => terminal.branchName)),
    [terminals],
  );
  const sites = useMemo(
    () => uniqueSorted(terminals.map((terminal) => terminal.site)),
    [terminals],
  );
  const businessTypes = useMemo(
    () =>
      uniqueSorted(
        terminals.map((terminal) => terminal.businessType?.trim() || "Unknown"),
      ),
    [terminals],
  );

  const filteredTerminals = useMemo(
    () => terminals.filter((terminal) => matchesFilters(terminal, filters)),
    [filters, terminals],
  );

  const filtersActive = Object.values(filters).some((value) => value !== ALL);

  const updateFilter = (key: keyof PosTerminalFilters, value: string) => {
    setSearchParams(filtersToSearchParams({ ...filters, [key]: value }), {
      replace: true,
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">POS Terminals</h1>
          <p className="text-sm text-muted-foreground">
            Live terminals only. Search and filter the merchant fleet.
            {filters.merchant !== ALL ? ` Filtered to ${filters.merchant}.` : ""}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/pos-dashboard")}>
          <ArrowLeft className="size-4" />
          POS dashboard
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Status"
          value={filters.status}
          options={statuses}
          onChange={(status) => updateFilter("status", status)}
        />
        <FilterSelect
          label="District"
          value={filters.district}
          options={districts}
          onChange={(district) => updateFilter("district", district)}
        />
        <FilterSelect
          label="Branch"
          value={filters.branch}
          options={branches}
          onChange={(branch) => updateFilter("branch", branch)}
        />
        <FilterSelect
          label="Site"
          value={filters.site}
          options={sites}
          onChange={(site) => updateFilter("site", site)}
        />
        <FilterSelect
          label="Business type"
          value={filters.businessType}
          options={businessTypes}
          onChange={(businessType) => updateFilter("businessType", businessType)}
        />
        {filtersActive ? (
          <Button
            variant="ghost"
            onClick={() =>
              setSearchParams(filtersToSearchParams(emptyPosTerminalFilters), {
                replace: true,
              })
            }
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <DataTable
        loading={loading}
        columns={columns}
        data={filteredTerminals}
        searchPlaceholder="Search POS terminals..."
        exportFileName="pos-terminals"
      />
    </div>
  );
};

export default PosTerminals;
