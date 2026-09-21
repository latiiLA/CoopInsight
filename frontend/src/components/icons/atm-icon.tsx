import { forwardRef } from "react";
import { MdAtm } from "react-icons/md";
import type { IconBaseProps } from "react-icons";

/** Material Design ATM mark for nav icons. */
export const AtmIcon = forwardRef<SVGSVGElement, IconBaseProps>(
  function AtmIcon({ className, size = 16, ...props }, ref) {
    return (
      <MdAtm
        ref={ref}
        className={className}
        size={size}
        aria-hidden
        {...props}
      />
    );
  },
);
