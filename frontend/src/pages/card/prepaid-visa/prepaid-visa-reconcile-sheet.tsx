import type { ReactNode } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { fetchPrepaidVisaCardActivity } from "@/features/prepaid_visa_slice";
import type { PrepaidVisaCardActivity } from "@/types/prepaid-visa";
import { AppDispatch, RootState } from "../../../../app/store/store";

import {
  formatMerchantLabel,
  formatUsd,
  isReversalMsgType,
  productLabel,
  txnResultLabel,
} from "./prepaid-visa-format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  activity: PrepaidVisaCardActivity | null;
  error?: string | null;
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
      <p className="mt-0.5 break-words text-sm font-medium leading-snug tabular-nums">
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

function kindLabel(kind: string): string {
  switch (kind) {
    case "top-up":
      return "Top-up";
    case "unload":
      return "Unload";
    case "spend":
      return "Spend";
    case "reversal":
      return "Reversal";
    default:
      return "Other";
  }
}

function formatSigned(value: number): string {
  const abs = formatUsd(Math.abs(value));
  if (value > 0.009) {
    return `+${abs}`;
  }
  if (value < -0.009) {
    return `−${abs}`;
  }
  return formatUsd(0);
}

function cardLineSuffix(
  showCard: boolean,
  cardMasked: string | undefined | null,
): string {
  if (!showCard) {
    return "";
  }
  const masked = (cardMasked ?? "").trim();
  return masked ? ` · ${masked}` : "";
}

function TruncatedNote({ shown }: { shown: number }) {
  return (
    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
      Showing first {shown.toLocaleString()} — more exist on this wallet.
    </p>
  );
}

function LoadMoreRow({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-2 flex justify-center border-t pt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={loading}
        onClick={onClick}
        className="h-8 text-xs"
      >
        {loading ? (
          <>
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            Loading…
          </>
        ) : (
          "Load more"
        )}
      </Button>
    </div>
  );
}

function ReconcileSheetSkeleton() {
  return (
    <>
      <div className="border-b bg-muted/30 px-4 pt-3.5 pr-11 pb-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-2 h-5 w-56" />
        <Skeleton className="mt-1.5 h-4 w-36" />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <section className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <div className="rounded-md border bg-muted/20 px-3 py-2.5">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
              <div className="col-span-2 space-y-1">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <Skeleton className="mt-2 h-3 w-full" />
          </div>
        </section>
        <section className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <div className="space-y-0 divide-y rounded-md border bg-muted/20 px-3 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <div className="space-y-0 divide-y rounded-md border bg-muted/20 px-3 py-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
                <Skeleton className="h-3 w-52" />
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-1.5">
          <Skeleton className="h-3 w-32" />
          <div className="space-y-0 divide-y rounded-md border bg-muted/20 px-3 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export function PrepaidVisaReconcileSheet({
  open,
  onOpenChange,
  loading,
  activity,
  error,
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const {
    cardActivityLoadingMore,
    cardActivityTopUpPage,
    cardActivityUnloadPage,
    cardActivityLedgerPage,
    cardActivityTxnPage,
  } = useSelector((state: RootState) => state.prepaidVisa);

  const card = activity?.card;
  const holderName = card?.cardholderName?.trim() || "";
  const showPerCard = (card?.linkedCards ?? 1) > 1;
  const cardId = card?.cardId;

  const loadMore = (
    section: "ledger" | "topUps" | "unloads" | "transactions",
  ) => {
    if (!cardId || cardActivityLoadingMore) {
      return;
    }
    if (section === "ledger") {
      void dispatch(
        fetchPrepaidVisaCardActivity({
          cardId,
          ledgerPage: cardActivityLedgerPage + 1,
          append: "ledger",
        }),
      );
      return;
    }
    if (section === "topUps") {
      void dispatch(
        fetchPrepaidVisaCardActivity({
          cardId,
          topUpPage: cardActivityTopUpPage + 1,
          append: "topUps",
        }),
      );
      return;
    }
    if (section === "unloads") {
      void dispatch(
        fetchPrepaidVisaCardActivity({
          cardId,
          unloadPage: cardActivityUnloadPage + 1,
          append: "unloads",
        }),
      );
      return;
    }
    void dispatch(
      fetchPrepaidVisaCardActivity({
        cardId,
        txnPage: cardActivityTxnPage + 1,
        append: "transactions",
      }),
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {loading ? (
          <ReconcileSheetSkeleton />
        ) : error ? (
          <div className="p-4 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </div>
        ) : card ? (
          <>
            <SheetHeader className="gap-0 space-y-0 border-b p-0 text-left">
              <div className="bg-muted/30 px-4 pt-3.5 pr-11 pb-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CreditCard className="size-3.5 shrink-0 text-primary" />
                  <SheetDescription className="truncate text-xs">
                    {productLabel(card.productCode)}
                  </SheetDescription>
                  <span className="text-border">·</span>
                  <span
                    className={cn(
                      "truncate font-medium",
                      card.matched
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-700 dark:text-rose-400",
                    )}
                  >
                    {card.matched ? "Matched" : "Mismatch"}
                  </span>
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
            </SheetHeader>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <Section title="Reconciliation">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  <Field label="Top-ups" value={formatUsd(card.topUpAmount)} />
                  <Field label="Expected" value={formatUsd(card.expected)} />
                  <Field
                    label="Available amount"
                    value={formatUsd(card.availableAmount)}
                  />
                  <Field
                    label="Available balance"
                    value={formatUsd(card.availableBalance)}
                  />
                  <Field
                    label="Blocked"
                    value={formatUsd(card.blockedBalance)}
                  />
                  <Field
                    label="From available"
                    value={formatUsd(card.fromAvailable)}
                  />
                  <Field
                    label="Unloaded"
                    value={formatUsd(card.unloaded)}
                  />
                  <Field
                    label="Variance"
                    value={formatUsd(card.variance)}
                    className="col-span-2"
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Expected = available amount + blocked + from available +
                  unloaded
                  {(card.linkedCards ?? 1) > 1
                    ? ` · ${card.linkedCards} cards share this wallet (amounts are combined)`
                    : ""}
                  . Account activity below shows what moved available.
                </p>
              </Section>

              {(activity?.topUps?.length ?? 0) > 0 ? (
                <Section title={`Top-ups (${activity?.topUps.length})`}>
                  <ul className="divide-y">
                    {activity?.topUps.map((r) => (
                      <li
                        key={r.accItemId}
                        className="flex items-center justify-between gap-3 py-1.5 text-sm first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {r.description || "Top-up"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.date} {r.time}
                            {cardLineSuffix(showPerCard, r.cardMasked)}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums font-medium">
                          {formatUsd(r.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {activity?.topUpsHasMore ? (
                    <>
                      <TruncatedNote shown={activity.topUps.length} />
                      <LoadMoreRow
                        loading={cardActivityLoadingMore}
                        onClick={() => loadMore("topUps")}
                      />
                    </>
                  ) : null}
                </Section>
              ) : (
                <Section title="Top-ups">
                  <p className="text-sm text-muted-foreground">
                    No recorded top-ups for this wallet.
                  </p>
                </Section>
              )}

              {(activity?.unloads?.length ?? 0) > 0 ? (
                <Section title={`Unloads (${activity?.unloads.length})`}>
                  <ul className="divide-y">
                    {activity?.unloads.map((r) => (
                      <li
                        key={r.accItemId}
                        className="flex items-center justify-between gap-3 py-1.5 text-sm first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {r.description || "Account unload"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.date} {r.time}
                            {cardLineSuffix(showPerCard, r.cardMasked)}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums font-medium">
                          {formatUsd(r.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {activity?.unloadsHasMore ? (
                    <>
                      <TruncatedNote shown={activity.unloads.length} />
                      <LoadMoreRow
                        loading={cardActivityLoadingMore}
                        onClick={() => loadMore("unloads")}
                      />
                    </>
                  ) : null}
                </Section>
              ) : null}

              <Section
                title={`Account activity (${activity?.ledger.length ?? 0})`}
              >
                {(activity?.ledger.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No account postings found.
                  </p>
                ) : (
                  <>
                    <ul className="divide-y">
                      {activity?.ledger.map((r) => {
                        const highlight =
                          Math.abs(r.amount) > 0.009 &&
                          Math.abs(Math.abs(r.availableDelta) - r.amount) >
                            0.05;
                        return (
                          <li
                            key={r.accItemId}
                            className="space-y-0.5 py-2 text-sm first:pt-0 last:pb-0"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {r.description || kindLabel(r.kind)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {r.date} {r.time} · {kindLabel(r.kind)}
                                  {cardLineSuffix(showPerCard, r.cardMasked)}
                                </p>
                              </div>
                              <span className="shrink-0 tabular-nums font-medium">
                                {formatUsd(r.amount)}
                              </span>
                            </div>
                            <p
                              className={cn(
                                "text-xs tabular-nums text-muted-foreground",
                                highlight &&
                                  "font-medium text-amber-700 dark:text-amber-400",
                              )}
                            >
                              From available {formatSigned(r.availableDelta)}
                              {Math.abs(r.blockedDelta) > 0.009
                                ? ` · Blocked ${formatSigned(r.blockedDelta)}`
                                : ""}
                              {" · "}
                              Bal after {formatUsd(r.availableAfter)}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                    {activity?.ledgerHasMore ? (
                      <>
                        <TruncatedNote shown={activity.ledger.length} />
                        <LoadMoreRow
                          loading={cardActivityLoadingMore}
                          onClick={() => loadMore("ledger")}
                        />
                      </>
                    ) : null}
                  </>
                )}
              </Section>

              {(activity?.transactions.length ?? 0) > 0 ? (
                <Section
                  title={`Switch transactions (${activity?.transactions.length})`}
                >
                  <ul className="divide-y">
                    {activity?.transactions.map((r) => (
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
                            {cardLineSuffix(showPerCard, r.cardMasked)}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums font-medium">
                          {formatUsd(r.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {activity?.transactionsHasMore ? (
                    <>
                      <TruncatedNote shown={activity.transactions.length} />
                      <LoadMoreRow
                        loading={cardActivityLoadingMore}
                        onClick={() => loadMore("transactions")}
                      />
                    </>
                  ) : null}
                </Section>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
