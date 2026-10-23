import type { ReactNode } from "react";
import { Network } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { SwitchTransactionDetail } from "@/types/switch-transaction-search";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: SwitchTransactionDetail | null;
  loading: boolean;
  error: string | null;
};

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number | undefined | null;
  className?: string;
}) {
  const text =
    value == null || value === ""
      ? "-"
      : typeof value === "number"
        ? value.toLocaleString(undefined, {
            maximumFractionDigits: 6,
          })
        : String(value);
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium leading-snug">
        {text}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h4>
      <div className="rounded-md border bg-muted/20 px-3 py-2.5">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">{children}</div>;
}

function money(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return "-";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SwitchTransactionDetailSheet({
  open,
  onOpenChange,
  detail,
  loading,
  error,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="gap-0 space-y-0 border-b p-0 text-left">
          <div className="bg-muted/30 px-4 pt-3.5 pr-11 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Network className="size-3.5 shrink-0 text-primary" />
              Switch transaction detail
            </div>
            <SheetTitle className="mt-1 text-base">
              {detail?.rrn?.trim() ||
                (loading ? "Loading..." : "Transaction")}
            </SheetTitle>
            <SheetDescription className="mt-0.5">
              {detail
                ? `${detail.date || "-"} ${detail.time || ""}`.trim()
                : error || "Full switch log fields for this row"}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading detail...</p>
          ) : null}
          {error && !loading ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          {detail && !loading ? (
            <>
              <Section title="Outcome">
                <Grid>
                  <Field
                    label="Result"
                    value={detail.approved ? "Approved" : "Declined"}
                  />
                  <Field label="Response code" value={detail.rspCode} />
                  <Field label="Alpha response" value={detail.alphaRspCode} />
                  <Field label="Approval code" value={detail.authNum} />
                  <Field label="Reason code" value={detail.reasonCode} />
                  <Field label="Reversal code" value={detail.revCode} />
                </Grid>
              </Section>

              <Section title="Identity">
                <Grid>
                  <Field label="RRN" value={detail.rrn} />
                  <Field label="Trace" value={detail.trace} />
                  <Field label="Original trace" value={detail.origTrace} />
                  <Field label="Transaction id" value={detail.transId} />
                  <Field label="Invoice" value={detail.invoiceNumber} />
                  <Field label="Log id" value={detail.rowId} className="col-span-2" />
                </Grid>
              </Section>

              <Section title="Timing">
                <Grid>
                  <Field label="Local date" value={detail.date} />
                  <Field label="Local time" value={detail.time} />
                  <Field label="Tran date" value={detail.tranDate} />
                  <Field label="Tran time" value={detail.tranTime} />
                  <Field label="Settlement date" value={detail.settleDate} />
                </Grid>
              </Section>

              <Section title="Card">
                <Grid>
                  <Field
                    label="Card"
                    value={detail.cardMasked}
                    className="col-span-2"
                  />
                  <Field label="Product" value={detail.productCode} />
                  <Field label="Card sequence" value={detail.cardSeqNo} />
                  <Field
                    label="Account"
                    value={detail.account}
                    className="col-span-2"
                  />
                </Grid>
              </Section>

              <Section title="Merchant and terminal">
                <Grid>
                  <Field
                    label="Merchant"
                    value={detail.merchantName}
                    className="col-span-2"
                  />
                  <Field label="Terminal" value={detail.terminalId} />
                  <Field
                    label="Terminal location"
                    value={detail.terminalLocation}
                  />
                  <Field label="MCC" value={detail.mcc} />
                  <Field
                    label="Acquiring country"
                    value={detail.acquiringCountry}
                  />
                  <Field label="Store" value={detail.storeId} />
                  <Field label="Branch" value={detail.branch} />
                </Grid>
              </Section>

              <Section title="Routing">
                <Grid>
                  <Field label="Source" value={detail.txnSrc} />
                  <Field label="Destination" value={detail.txnDest} />
                  <Field label="Acquirer" value={detail.acquirer} />
                  <Field label="Issuer" value={detail.issuer} />
                  <Field label="Source node" value={detail.srcNode} />
                  <Field label="Dest node" value={detail.destNode} />
                </Grid>
              </Section>

              <Section title="Message">
                <Grid>
                  <Field label="Message type" value={detail.msgType} />
                  <Field label="Original message" value={detail.origMsgType} />
                  <Field label="Processing code" value={detail.txnCode} />
                  <Field label="Txn type" value={detail.txnType} />
                </Grid>
              </Section>

              <Section title="Amounts">
                <Grid>
                  <Field
                    label="Amount (issuer currency)"
                    value={`${money(detail.amount)} (${detail.issuerCurrency || "-"})`}
                  />
                  <Field
                    label="Acquirer currency"
                    value={detail.acquirerCurrency}
                  />
                  <Field
                    label="Txn amount"
                    value={`${money(detail.txnAmount)} (${detail.txnCurrency || "-"})`}
                  />
                  <Field
                    label="Cardholder currency"
                    value={detail.cardholderCurrency}
                  />
                  <Field
                    label="Settlement"
                    value={`${money(detail.settlementAmount)} (${detail.settlementCurrency || "-"})`}
                  />
                  <Field label="Cashback" value={money(detail.cashback)} />
                  <Field label="Fee" value={money(detail.fee)} />
                  <Field
                    label="Available balance"
                    value={money(detail.availableBalance)}
                  />
                  <Field
                    label="Ledger balance"
                    value={money(detail.ledgerBalance)}
                  />
                </Grid>
              </Section>

              <Section title="POS">
                <Grid>
                  <Field label="Entry mode" value={detail.posEntryMode} />
                  <Field label="Condition" value={detail.posCondition} />
                  <Field label="Device capability" value={detail.deviceCap} />
                </Grid>
              </Section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
