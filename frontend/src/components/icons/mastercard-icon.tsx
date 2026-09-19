import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

/** Compact Mastercard circles mark for nav icons. */
export const MastercardIcon = forwardRef<SVGSVGElement, LucideProps>(
  function MastercardIcon({ className, size = 16, ...props }, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        className={className}
        aria-hidden
        {...props}
      >
        <circle cx="8" cy="12" r="6.5" fill="#EB001B" />
        <circle cx="16" cy="12" r="6.5" fill="#F79E1B" />
        <path
          fill="#FF5F00"
          d="M12 6.35A6.48 6.48 0 0 0 9.6 12 6.48 6.48 0 0 0 12 17.65 6.48 6.48 0 0 0 14.4 12 6.48 6.48 0 0 0 12 6.35z"
        />
      </svg>
    );
  },
);
