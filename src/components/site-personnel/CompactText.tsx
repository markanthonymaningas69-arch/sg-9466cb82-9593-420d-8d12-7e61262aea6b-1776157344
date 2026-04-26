import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CompactTextProps {
  value: string | number | null | undefined;
  className?: string;
  tooltipClassName?: string;
}

export function CompactText({ value, className, tooltipClassName }: CompactTextProps) {
  const text = value === null || value === undefined || value === "" ? "—" : String(value);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("block max-w-full truncate whitespace-nowrap", className)}>{text}</span>
        </TooltipTrigger>
        <TooltipContent className={cn("max-w-sm break-words text-xs", tooltipClassName)}>
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}