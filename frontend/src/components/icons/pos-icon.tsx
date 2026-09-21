import { forwardRef } from "react";
import { MdPointOfSale } from "react-icons/md";
import type { IconBaseProps } from "react-icons";

/** Material Design point-of-sale mark for nav icons. */
export const PosIcon = forwardRef<SVGSVGElement, IconBaseProps>(
  function PosIcon({ className, size = 16, ...props }, ref) {
    return (
      <MdPointOfSale
        ref={ref}
        className={className}
        size={size}
        aria-hidden
        {...props}
      />
    );
  },
);
