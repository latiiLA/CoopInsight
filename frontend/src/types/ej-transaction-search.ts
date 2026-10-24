export type EJCameraImage = {
  camera: number;
  filename: string;
};

export type EJTransaction = {
  id: string;
  terminalId: string;
  filename: string;
  path?: string;
  ejDate: string;
  cardFirst4: string;
  cardLast4: string;
  cardMasked: string;
  amount: number;
  authNum: string;
  respCode: string;
  status: string;
  startTime: string;
  endTime: string;
  txnType: string;
  atmType: string;
  /** Account / customer info entered at the ATM (when present). */
  customerAccount?: string;
  /** Camera capture filenames logged in the journal block. */
  cameraImages?: EJCameraImage[];
  /** Absolute byte start of the journal block in the EJ file. */
  fileOffset?: number;
  /** 1-based line of TRANSACTION START in the EJ file. */
  lineStart?: number;
  lineEnd?: number;
  /** Full journal block text for locating the txn in the EJ. */
  rawText?: string;
};

export type EJTransactionSearchArgs = {
  dateFrom?: string;
  dateTo?: string;
  card?: string;
  cardFirst4?: string;
  cardLast4?: string;
  terminal?: string;
  authNum?: string;
  /** SUCCESS | FAILED; omit for all */
  status?: string;
  /** Exact amount match */
  amount?: number;
  customerAccount?: string;
  page?: number;
  pageSize?: number;
};

export type EJTransactionSearchResult = {
  page: number;
  pageSize: number;
  hasMore: boolean;
  items: EJTransaction[];
};

export type EJJournalView = {
  id: string;
  terminalId: string;
  filename: string;
  path?: string;
  ejDate?: string;
  lineStart?: number;
  lineEnd?: number;
  fileOffset?: number;
  rawText: string;
  source: string;
};

export type EJJournalFileView = {
  id: string;
  terminalId: string;
  filename: string;
  path?: string;
  ejDate?: string;
  sizeBytes: number;
  content: string;
  truncated: boolean;
  highlightLine?: number;
  highlightLineEnd?: number;
};

/** Normalize Mongo ObjectId shapes from the API. */
export function ejTransactionId(row: { id?: unknown } | null | undefined): string {
  if (!row?.id) return "";
  const id = row.id;
  if (typeof id === "string") return id;
  if (typeof id === "object" && id !== null && "$oid" in id) {
    return String((id as { $oid: string }).$oid);
  }
  return String(id);
}
