export class EmbedError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export function describeFailure(status: number, serverMessage?: string) {
  switch (status) {
    case 401:
      return "Invalid embed key";
    case 404:
      return "Embed API is not enabled on this server";
    case 429:
      return "Too many requests — slow the panel refresh";
    case 503:
      return "Report database (Oracle) is unavailable — try again shortly";
    case 504:
      return "Report query timed out";
    default:
      return serverMessage || `Request failed (HTTP ${status})`;
  }
}

export const MISSING_KEY_ERROR = new EmbedError(
  "Missing embed key — open this page as /embed.html#apiKey=<EMBED_API_KEY from backend/.env>",
  401,
);

/**
 * GETs an /api/embed endpoint with the shared key and returns `data` from the
 * standard envelope, throwing EmbedError with a panel-friendly message.
 */
export async function getEmbedJson<T>(
  path: string,
  apiKey: string,
  params: Record<string, string | number>,
  signal: AbortSignal,
): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).map(([name, value]) => [name, String(value)]),
  );
  const response = await fetch(`/api/embed${path}?${query.toString()}`, {
    headers: { "X-Api-Key": apiKey },
    signal,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new EmbedError(describeFailure(response.status, body?.message), response.status);
  }
  if (!body?.isSuccessful || !body?.data) {
    throw new EmbedError(body?.message ?? "Malformed embed response");
  }
  return body.data as T;
}
