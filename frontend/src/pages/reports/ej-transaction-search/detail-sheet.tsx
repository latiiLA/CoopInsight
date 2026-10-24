import type { ReactNode } from "react";
import { BookOpen, Copy, FileSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { EJTransaction } from "@/types/ej-transaction-search";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: EJTransaction | null;
  onOpenJournal?: (row: EJTransaction) => void;
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
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
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
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h4>
        {action}
      </div>
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

function lineRange(detail: EJTransaction) {
  if (!detail.lineStart) return "-";
  if (detail.lineEnd && detail.lineEnd !== detail.lineStart) {
    return `${detail.lineStart}-${detail.lineEnd}`;
  }
  return String(detail.lineStart);
}

async function copyText(label: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy");
  }
}

export function EJTransactionDetailSheet({
  open,
  onOpenChange,
  detail,
  onOpenJournal,
}: Props) {
  const title =
    detail?.authNum?.trim() ||
    detail?.cardMasked?.trim() ||
    detail?.terminalId ||
    "Journal row";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="gap-0 space-y-0 border-b p-0 text-left">
          <div className="bg-muted/30 px-4 pt-3.5 pr-11 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSearch className="size-3.5 shrink-0 text-primary" />
              EJ Finder detail
            </div>
            <SheetTitle className="mt-1 text-base">{title}</SheetTitle>
            <SheetDescription className="mt-0.5">
              {detail
                ? `${detail.ejDate || "-"} ${detail.startTime || ""}`.trim()
                : "ATM electronic journal row"}
            </SheetDescription>
            {detail && onOpenJournal ? (
              <Button
                type="button"
                className="mt-3 w-full sm:w-auto"
                onClick={() => onOpenJournal(detail)}
              >
                <BookOpen className="mr-1.5 size-4" />
                Open journal
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {detail ? (
            <>
              <Section title="Outcome">
                <Grid>
                  <Field label="Status" value={detail.status} />
                  <Field label="Response" value={detail.respCode} />
                  <Field label="Type" value={detail.txnType} />
                  <Field label="Amount" value={money(detail.amount)} />
                </Grid>
              </Section>

              <Section title="Card">
                <Grid>
                  <Field
                    label="Masked"
                    value={detail.cardMasked}
                    className="col-span-2"
                  />
                  <Field label="First 4" value={detail.cardFirst4} />
                  <Field label="Last 4" value={detail.cardLast4} />
                  <Field
                    label="Customer account"
                    value={detail.customerAccount}
                    className="col-span-2"
                  />
                </Grid>
              </Section>

              {detail.cameraImages && detail.cameraImages.length > 0 ? (
                <Section
                  title="Camera images"
                  action={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        void copyText(
                          "Image names",
                          detail.cameraImages!
                            .map((img) => img.filename)
                            .join("\n"),
                        )
                      }
                    >
                      <Copy className="mr-1 size-3" />
                      Copy names
                    </Button>
                  }
                >
                  <ul className="space-y-1.5">
                    {detail.cameraImages.map((img) => (
                      <li
                        key={`${img.camera}-${img.filename}`}
                        className="flex items-baseline justify-between gap-3 rounded-md border bg-muted/20 px-2.5 py-1.5 font-mono text-[11px]"
                      >
                        <span className="text-muted-foreground">
                          Camera {img.camera || "-"}
                        </span>
                        <button
                          type="button"
                          className="min-w-0 truncate text-right text-foreground hover:underline"
                          title={img.filename}
                          onClick={() =>
                            void copyText("Image name", img.filename)
                          }
                        >
                          {img.filename}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              <Section
                title="Locate in journal"
                action={
                  detail.lineStart ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        void copyText("Line", String(detail.lineStart))
                      }
                    >
                      <Copy className="mr-1 size-3" />
                      Copy line
                    </Button>
                  ) : null
                }
              >
                <Grid>
                  <Field label="Terminal" value={detail.terminalId} />
                  <Field label="ATM type" value={detail.atmType} />
                  <Field label="Auth number" value={detail.authNum} />
                  <Field label="EJ line" value={lineRange(detail)} />
                  <Field
                    label="Journal file"
                    value={detail.filename}
                    className="col-span-2"
                  />
                  {detail.path ? (
                    <Field
                      label="File path"
                      value={detail.path}
                      className="col-span-2"
                    />
                  ) : null}
                </Grid>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Open the journal file and go to line {detail.lineStart || "-"}{" "}
                  to land on this transaction block.
                </p>
              </Section>

              <Section title="Timing">
                <Grid>
                  <Field label="Date" value={detail.ejDate} />
                  <Field label="Start" value={detail.startTime} />
                  <Field label="End" value={detail.endTime} />
                </Grid>
              </Section>

              {detail.rawText ? (
                <Section
                  title="Journal text"
                  action={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => void copyText("Journal text", detail.rawText!)}
                    >
                      <Copy className="mr-1 size-3" />
                      Copy
                    </Button>
                  }
                >
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground">
                    {detail.rawText}
                  </pre>
                </Section>
              ) : onOpenJournal ? (
                <p className="text-sm text-muted-foreground">
                  Use Open journal above to view this transaction block.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a row to view details.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
