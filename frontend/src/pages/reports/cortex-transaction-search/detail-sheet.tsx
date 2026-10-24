import type { ReactNode } from "react";
import { CreditCard } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatMoneyWithCurrency } from "@/lib/iso-currency";
import { msgTypeDisplay } from "@/lib/msg-type";
import { cn } from "@/lib/utils";
import type { CortexTransactionDetail } from "@/types/cortex-transaction-search";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: CortexTransactionDetail | null;
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
    <section className="space-y-1.5">
      <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
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

export function CortexTransactionDetailSheet({
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
              <CreditCard className="size-3.5 shrink-0 text-primary" />
              Transaction detail
            </div>
            <SheetTitle className="mt-1 text-base">
              {detail?.rrn?.trim() ||
                (loading ? "Loading..." : "Transaction")}
            </SheetTitle>
            <SheetDescription className="mt-0.5">
              {detail
                ? `${detail.date || "-"} ${detail.time || ""}`.trim()
                : error || "Full Cortex log fields for this row"}
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
                  <Field label="Action code" value={detail.actionCode} />
                  <Field label="Approval code" value={detail.approvalCode} />
                  <Field label="Reason code" value={detail.reasonCode} />
                  <Field label="Response source" value={detail.rspSource} />
                  <Field label="STIP reason" value={detail.stipReason} />
                  <Field label="Reject reason" value={detail.rejectReason} />
                </Grid>
              </Section>

              <Section title="Identity">
                <Grid>
                  <Field label="RRN" value={detail.rrn} />
                  <Field label="STAN" value={detail.stan} />
                  <Field label="Original STAN" value={detail.originalStan} />
                  <Field label="TRN" value={detail.trn} />
                  <Field label="ARN" value={detail.arn} className="col-span-2" />
                  <Field label="Log id" value={detail.tlogId} />
                  <Field label="Created" value={detail.createdAt} />
                </Grid>
              </Section>

              <Section title="Timing">
                <Grid>
                  <Field label="Switch date" value={detail.date} />
                  <Field label="Switch time" value={detail.time} />
                  <Field label="Local date" value={detail.localDate} />
                  <Field label="Local time" value={detail.localTime} />
                  <Field label="Transmit date" value={detail.transmitDate} />
                  <Field label="Transmit time" value={detail.transmitTime} />
                </Grid>
              </Section>

              <Section title="Card">
                <Grid>
                  <Field
                    label="Card"
                    value={detail.cardMasked}
                    className="col-span-2"
                  />
                  {detail.cardholderName ? (
                    <Field
                      label="Cardholder"
                      value={detail.cardholderName}
                      className="col-span-2"
                    />
                  ) : null}
                  <Field
                    label="Product"
                    value={detail.productName || detail.productCode}
                  />
                  <Field
                    label="Card status"
                    value={detail.statusDescription || detail.statusCode}
                  />
                  <Field
                    label="Branch"
                    value={detail.branchName || detail.branchCode}
                  />
                  <Field label="Card sequence" value={detail.cardSeqNo} />
                  <Field label="Expiry" value={detail.expiryDate} />
                  <Field label="Service code" value={detail.serviceCode} />
                  <Field label="ATC" value={detail.atc} />
                </Grid>
              </Section>

              <Section title="Merchant and terminal">
                <Grid>
                  <Field
                    label="Merchant"
                    value={detail.merchantName}
                    className="col-span-2"
                  />
                  <Field label="Merchant id" value={detail.merchantId} />
                  <Field
                    label="Merchant category"
                    value={detail.merchantBusiness}
                  />
                  <Field label="Location name" value={detail.merchantLocName} />
                  <Field label="Street" value={detail.merchantStreet} />
                  <Field label="City" value={detail.merchantCity} />
                  <Field label="Postcode" value={detail.merchantPostcode} />
                  <Field label="Region" value={detail.merchantRegion} />
                  <Field label="Country" value={detail.merchantCountry} />
                  <Field label="Terminal" value={detail.terminalId} />
                  <Field label="Terminal type" value={detail.terminalType} />
                  <Field
                    label="Acquirer country"
                    value={detail.acquirerCountry}
                  />
                </Grid>
              </Section>

              <Section title="Routing">
                <Grid>
                  <Field label="Txn source" value={detail.txnSource} />
                  <Field label="Route" value={detail.routeIid} />
                  <Field label="Source" value={detail.sourceIid} />
                  <Field label="Source country" value={detail.sourceCountry} />
                  <Field label="Destination" value={detail.destIid} />
                  <Field label="Dest country" value={detail.destCountry} />
                  <Field label="Acquiring id" value={detail.acquiringIid} />
                  <Field label="Forwarding id" value={detail.forwardingIid} />
                  <Field label="Receiving id" value={detail.receivingIid} />
                  <Field label="Settlement id" value={detail.settlementIid} />
                </Grid>
              </Section>

              <Section title="Message">
                <Grid>
                  <Field
                    label="Message class"
                    value={msgTypeDisplay(detail.msgClass) || "-"}
                  />
                  <Field label="Message function" value={detail.msgFunction} />
                  <Field label="Txn code" value={detail.txnCode} />
                  <Field label="Sub txn code" value={detail.subTxnCode} />
                  <Field label="Txn status" value={detail.txnStatus} />
                  <Field label="Function code" value={detail.functionCode} />
                  <Field label="Scheme" value={detail.scheme} />
                  <Field label="Cleared" value={detail.cleared} />
                  <Field label="Auth life" value={detail.authLife} />
                  <Field label="Auth expiry" value={detail.authExpiry} />
                </Grid>
              </Section>

              <Section title="Amounts">
                <Grid>
                  <Field
                    label="Billing amount (card)"
                    value={formatMoneyWithCurrency(
                      detail.amount,
                      detail.currency,
                    )}
                  />
                  <Field
                    label="Txn amount (merchant)"
                    value={formatMoneyWithCurrency(
                      detail.amountTxn,
                      detail.txnCurrency,
                    )}
                  />
                  <Field
                    label="Original amount"
                    value={money(detail.amountTxnOrg)}
                  />
                  <Field
                    label="Cashback"
                    value={money(detail.amountCashback)}
                  />
                  <Field label="Txn fee" value={money(detail.amountTxnFee)} />
                  <Field
                    label="Processing fee"
                    value={money(detail.amountProcFee)}
                  />
                  <Field label="Tax" value={money(detail.amountTax)} />
                  <Field
                    label="Commission"
                    value={money(detail.amountCommission)}
                  />
                  <Field
                    label="Settlement"
                    value={formatMoneyWithCurrency(
                      detail.amountSettlement,
                      detail.settlementCurrency,
                    )}
                  />
                  <Field
                    label="Settlement rate"
                    value={detail.settlementRate}
                  />
                  <Field label="Billing rate" value={detail.billingRate} />
                </Grid>
              </Section>

              <Section title="Accounts">
                <Grid>
                  <Field
                    label="Account 1"
                    value={detail.account1}
                    className="col-span-2"
                  />
                  <Field label="Account 1 type" value={detail.account1Type} />
                  <Field
                    label="Account 2"
                    value={detail.account2}
                    className="col-span-2"
                  />
                  <Field label="Account 2 type" value={detail.account2Type} />
                </Grid>
              </Section>

              <Section title="POS">
                <Grid>
                  <Field label="Capability" value={detail.posCapability} />
                  <Field label="Entry mode" value={detail.posEntryMode} />
                </Grid>
              </Section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
