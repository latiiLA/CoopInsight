import type { ReactNode } from "react";
import { CreditCard } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  PrepaidVisaTopUp,
  PrepaidVisaTransaction,
  PrepaidVisaUnload,
} from "@/types/prepaid-visa";

import {
  formatMerchantLabel,
  formatUsd,
  isReversalMsgType,
  txnResultLabel,
  productLabel,
} from "./prepaid-visa-format";

export type PrepaidVisaCardFocus =
  | { kind: "top-up"; row: PrepaidVisaTopUp }
  | { kind: "unload"; row: PrepaidVisaUnload }
  | { kind: "transaction"; row: PrepaidVisaTransaction };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focus: PrepaidVisaCardFocus | null;
  relatedTopUps?: PrepaidVisaTopUp[];
  relatedTransactions?: PrepaidVisaTransaction[];
};

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium leading-snug">
        {value || "—"}
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

export function PrepaidVisaCardSheet({
  open,
  onOpenChange,
  focus,
  relatedTopUps = [],
  relatedTransactions = [],
}: Props) {
  const card = focus?.row;
  const otherTopUps =
    card == null
      ? []
      : relatedTopUps.filter(
          (r) =>
            r.cardId === card.cardId &&
            !(
              focus?.kind === "top-up" && r.accItemId === focus.row.accItemId
            ),
        );
  const otherTxns =
    card == null
      ? []
      : relatedTransactions.filter(
          (r) =>
            r.cardId === card.cardId &&
            !(
              focus?.kind === "transaction" && r.tlogId === focus.row.tlogId
            ),
        );

  const accountNumber =
    focus?.kind === "top-up" || focus?.kind === "unload"
      ? focus.row.accountNumber
      : undefined;
  const holderName = card?.cardholderName?.trim() || "";
  const statusLabel =
    card?.statusDescription || card?.statusCode || "Status";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {card ? (
          <>
            <SheetHeader className="gap-0 space-y-0 border-b p-0 text-left">
              <div className="bg-muted/30 px-4 pt-3.5 pr-11 pb-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CreditCard className="size-3.5 shrink-0 text-primary" />
                  <SheetDescription className="truncate text-xs">
                    {productLabel(card.productCode)}
                  </SheetDescription>
                  <span className="text-border">·</span>
                  <span className="truncate">{statusLabel}</span>
                </div>

                <SheetTitle className="mt-1.5 text-base leading-snug font-semibold tracking-tight">
                  {holderName || card.cardMasked || "Card details"}
                </SheetTitle>

                {holderName ? (
                  <p className="mt-0.5 font-mono text-sm tracking-wide text-muted-foreground">
                    {card.cardMasked}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-3 divide-x border-t bg-background">
                <div className="px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Available amt
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums tracking-tight">
                    {formatUsd(
                      card.availableAmount ?? card.availableBalance,
                    )}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Blocked
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-sm font-semibold tabular-nums tracking-tight",
                      card.blockedBalance
                        ? "text-amber-700 dark:text-amber-400"
                        : "",
                    )}
                  >
                    {formatUsd(card.blockedBalance)}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    From available
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums tracking-tight">
                    {formatUsd(card.fromAvailable)}
                  </p>
                </div>
              </div>
              {card.accountCurrency ? (
                <p className="border-t px-4 py-1.5 text-[11px] text-muted-foreground">
                  Currency {card.accountCurrency}
                  {card.blockedBalance
                    ? " · Blocked holds pending clearing"
                    : ""}
                </p>
              ) : null}
            </SheetHeader>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <Section title="Card">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {holderName ? (
                    <Field
                      label="Cardholder"
                      value={holderName}
                      className="col-span-2"
                    />
                  ) : null}
                  <Field
                    label="Branch"
                    value={[card.branchCode, card.branchName]
                      .filter(Boolean)
                      .join(" · ")}
                    className="col-span-2"
                  />
                  {focus?.kind === "top-up" && focus.row.customerId ? (
                    <Field
                      label="Customer ID"
                      value={focus.row.customerId}
                      className="col-span-2"
                    />
                  ) : null}
                  {accountNumber ? (
                    <Field
                      label="Account"
                      value={accountNumber}
                      className="col-span-2"
                    />
                  ) : null}
                </div>
              </Section>

              {focus?.kind === "top-up" ? (
                <Section title="Selected top-up">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <Field
                      label="When"
                      value={[focus.row.date, focus.row.time]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <Field
                      label="Amount"
                      value={formatUsd(focus.row.amount)}
                    />
                    <Field
                      label="Description"
                      value={focus.row.description}
                      className="col-span-2"
                    />
                  </div>
                </Section>
              ) : focus?.kind === "unload" ? (
                <Section title="Selected unload">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <Field
                      label="When"
                      value={[focus.row.date, focus.row.time]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <Field
                      label="Amount"
                      value={formatUsd(focus.row.amount)}
                    />
                    <Field
                      label="Description"
                      value={focus.row.description || "Account unload"}
                      className="col-span-2"
                    />
                  </div>
                </Section>
              ) : focus?.kind === "transaction" ? (
                <Section title="Selected transaction">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <Field
                      label="When"
                      value={[focus.row.date, focus.row.time]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <Field
                      label="Amount"
                      value={formatUsd(focus.row.amount)}
                    />
                    <Field
                      label="Result"
                      value={txnResultLabel(focus.row)}
                    />
                    <Field label="RRN" value={focus.row.rrn} />
                    <Field
                      label="Merchant"
                      value={formatMerchantLabel(focus.row.merchantName)}
                      className="col-span-2"
                    />
                    <Field label="Terminal" value={focus.row.terminalId} />
                    <Field label="Txn type" value={focus.row.txnCode} />
                  </div>
                </Section>
              ) : null}

              {otherTopUps.length > 0 ? (
                <Section title={`Other top-ups (${otherTopUps.length})`}>
                  <ul className="divide-y">
                    {otherTopUps.slice(0, 8).map((r) => (
                      <li
                        key={r.accItemId}
                        className="flex items-center justify-between gap-3 py-1.5 text-sm first:pt-0 last:pb-0"
                      >
                        <span className="text-muted-foreground">
                          {r.date} {r.time}
                        </span>
                        <span className="tabular-nums font-medium">
                          {formatUsd(r.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {otherTxns.length > 0 ? (
                <Section
                  title={`Other transactions (${otherTxns.length})`}
                >
                  <ul className="divide-y">
                    {otherTxns.slice(0, 8).map((r) => (
                      <li
                        key={r.tlogId}
                        className="flex items-center justify-between gap-3 py-1.5 text-sm first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {formatMerchantLabel(r.merchantName)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.date} {r.time}
                            {isReversalMsgType(r.msgType) || !r.approved
                              ? ` · ${txnResultLabel(r)}`
                              : ""}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums font-medium">
                          {formatUsd(r.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
