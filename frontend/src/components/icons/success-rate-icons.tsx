import { forwardRef } from "react";
import {
  MdAccountBalance,
  MdCreditCard,
  MdHub,
  MdPayments,
  MdPercent,
  MdShowChart,
  MdSwapHoriz,
} from "react-icons/md";
import type { IconBaseProps } from "react-icons";

function mdIcon(
  Icon: typeof MdHub,
  displayName: string,
) {
  const Comp = forwardRef<SVGSVGElement, IconBaseProps>(
    function MdNavIcon({ className, size = 16, ...props }, ref) {
      return (
        <Icon
          ref={ref}
          className={className}
          size={size}
          aria-hidden
          {...props}
        />
      );
    },
  );
  Comp.displayName = displayName;
  return Comp;
}

/** Whole switch / hub. */
export const SwitchIcon = mdIcon(MdHub, "SwitchIcon");

/** On-us — CoopBank institution. */
export const OnUsIcon = mdIcon(MdAccountBalance, "OnUsIcon");

/** Off-us — cross-bank exchange (no currency symbol). */
export const OffUsIcon = mdIcon(MdSwapHoriz, "OffUsIcon");

/** Issuing — CoopBank cards elsewhere. */
export const IssuingIcon = mdIcon(MdCreditCard, "IssuingIcon");

/** Acquiring — inbound payments on CoopBank terminals. */
export const AcquiringIcon = mdIcon(MdPayments, "AcquiringIcon");

/** Success-rate section mark. */
export const SuccessRateIcon = mdIcon(MdPercent, "SuccessRateIcon");

/** Success-rate trends over time. */
export const SuccessRateTrendsIcon = mdIcon(MdShowChart, "SuccessRateTrendsIcon");

