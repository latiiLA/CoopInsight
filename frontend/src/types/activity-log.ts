export type ActivityLogStatus = "success" | "failure";

export type ActivityLog = {
  id: string;
  timestamp: string;
  actorUserId?: string;
  actorUsername: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  summary: string;
  status: ActivityLogStatus;
  ip?: string;
  userAgent?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
};

export type ActivityLogListResult = {
  items: ActivityLog[];
  total: number;
  page: number;
  pageSize: number;
};

export type FetchActivityLogsParams = {
  dateFrom: string;
  dateTo: string;
  actor?: string;
  action?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export function getActivityLogId(entry: ActivityLog): string {
  return entry.id;
}
