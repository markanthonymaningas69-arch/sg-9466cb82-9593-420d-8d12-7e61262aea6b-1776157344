import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ManpowerRateCatalogItem } from "@/services/manpowerRateCatalogService";

interface PositionRateSelectorProps {
  items: ManpowerRateCatalogItem[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const categoryLabels = {
  office: "Office Staff",
  construction: "Construction Worker",
} as const;

export function PositionRateSelector({
  items,
  value,
  onChange,
  disabled = false,
}: PositionRateSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === value) || null,
    [items, value]
  );

  const groupedItems = useMemo(() => {
    return (["office", "construction"] as const).map((category) => ({
      category,
      label: categoryLabels[category],
      items: items.filter(
        (item) => item.category === category && (item.status === "active" || item.id === value)
      ),
    }));
  }, [items, value]);

  const hasAnyOptions = groupedItems.some((group) => group.items.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          <span className="truncate text-left">
            {selectedItem
              ? `${selectedItem.positionName}${selectedItem.status === "inactive" ? " (Inactive current)" : ""}`
              : "Select active position"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search position..." />
          <CommandList>
            <CommandEmpty>
              {hasAnyOptions ? "No position matches your search." : "No active rates available in the HR Rates Catalog."}
            </CommandEmpty>
            {groupedItems.map((group) =>
              group.items.length > 0 ? (
                <CommandGroup key={group.category} heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.positionName} ${group.label} ${item.currency}`}
                      onSelect={() => {
                        onChange(item.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.positionName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.currency} {item.dailyRate.toFixed(2)}/day · {item.hourlyRate.toFixed(2)}/hr
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            item.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          )}
                        >
                          {item.status === "active" ? "Active" : "Inactive current"}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}