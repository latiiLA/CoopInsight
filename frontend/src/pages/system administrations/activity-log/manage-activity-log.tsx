import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearActivityLogs,
  fetchActivityLogs,
} from "@/features/activity_log_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { getColumns } from "./columns";

const ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "auth.login.success", label: "Login success" },
  { value: "auth.login.failure", label: "Login failure" },
  { value: "user.create", label: "User create" },
  { value: "user.update", label: "User update" },
  { value: "user.delete", label: "User delete" },
  { value: "role.create", label: "Role create" },
  { value: "role.update", label: "Role update" },
  { value: "role.delete", label: "Role delete" },
  { value: "permission.create", label: "Permission create" },
  { value: "permission.update", label: "Permission update" },
  { value: "permission.delete", label: "Permission delete" },
  { value: "account_request.create", label: "Account request" },
  { value: "account_request.fulfill", label: "Account approved" },
  { value: "switch.command.run", label: "Switch command" },
];

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

export default function ManageActivityLog() {
  const dispatch = useDispatch<AppDispatch>();
  const columns = useMemo(() => getColumns(), []);
  const todayRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);
  const [action, setAction] = useState("all");

  const { result, loading } = useSelector(
    (state: RootState) => state.activityLog,
  );

  const loadLogs = useCallback(
    async (date: DateRange | undefined, actionFilter: string) => {
      if (!date?.from || !date?.to) {
        return;
      }

      const response = await dispatch(
        fetchActivityLogs({
          dateFrom: format(date.from, "MM/dd/yyyy"),
          dateTo: format(date.to, "MM/dd/yyyy"),
          action: actionFilter === "all" ? undefined : actionFilter,
          page: 1,
          pageSize: 200,
        }),
      );

      if (fetchActivityLogs.rejected.match(response)) {
        toast.error(response.payload || "Failed to fetch activity logs");
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void loadLogs(dateRange, action);
  }, [action, dateRange, loadLogs]);

  useEffect(() => {
    return () => {
      dispatch(clearActivityLogs());
    };
  }, [dispatch]);

  return (
    <div className="container mx-auto">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Activity Log</h1>
          <p className="text-sm text-muted-foreground">
            Inspect logins and admin changes. Defaults to today; widen the range
            to review a longer period.
          </p>
        </div>
        <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
      </div>

      <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {result ? `${result.total.toLocaleString()} events` : null}
        </p>
      </div>

      <DataTable
        loading={loading}
        columns={columns}
        data={result?.items ?? []}
        searchPlaceholder="Search actor, summary, action…"
        exportFileName="activity-log"
      />
    </div>
  );
}
