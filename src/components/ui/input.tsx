import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onBlur, onFocus, ...props }, ref) => {
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Auto-format number inputs to 2 decimal places on blur
      if (type === "number" && e.target.value !== "") {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          e.target.value = val.toFixed(2);
          // Trigger a change event so React form state catches the formatted value
          const event = new Event("change", { bubbles: true });
          e.target.dispatchEvent(event);
        }
      }
      if (onBlur) onBlur(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Auto-select text on focus so typing immediately overwrites the default 0
      if (type === "number") {
        e.target.select();
      }
      if (onFocus) onFocus(e);
    };

    return (
      <input
        type={type}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
