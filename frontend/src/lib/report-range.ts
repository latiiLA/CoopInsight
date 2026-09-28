import { format } from "date-fns";

/**
 * Date formats for the success-rate endpoints.
 *
 * The API accepts either slash or dash form, but the backend's parseReportDate
 * always echoes the range back normalised to MM-DD-YYYY. A response therefore
 * has to be compared against the echo format, not the format that was sent, or
 * a perfectly valid report looks like a mismatch.
 */
export const API_DATE_FORMAT = "MM/dd/yyyy";

/** Layout the backend echoes dateFrom/dateTo in. Use this for comparisons. */
export const API_ECHO_DATE_FORMAT = "MM-dd-yyyy";

/** Formats a date for sending to the API. */
export function toApiDate(date: Date): string {
  return format(date, API_DATE_FORMAT);
}

/** Formats a date the way the API echoes it back, for response matching. */
export function toApiEchoDate(date: Date): string {
  return format(date, API_ECHO_DATE_FORMAT);
}
