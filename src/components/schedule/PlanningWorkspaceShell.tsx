import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface PlanningWorkspaceShellProps {
  toolbar: ReactNode;
  mainContent: ReactNode;
  sidePanel: ReactNode;
  sidePanelPlaceholder?: ReactNode;
  panelTitle: string;
  panelDescription?: string;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  workspaceHeightClassName?: string;
  panelWidthClassName?: string;
  className?: string;
}

export function PlanningWorkspaceShell({
  toolbar,
  mainContent,
  sidePanel,
  sidePanelPlaceholder,
  panelTitle,
  panelDescription,
  panelOpen,
  onPanelOpenChange,
  workspaceHeightClassName = "h-[calc(100vh-8rem)]",
  panelWidthClassName = "lg:grid-cols-[minmax(0,1fr)_24rem]",
  className,
}: PlanningWorkspaceShellProps) {
  const desktopGridClassName = panelOpen
    ? panelWidthClassName
    : "lg:grid-cols-[minmax(0,1fr)]";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm",
        workspaceHeightClassName,
        className
      )}
    >
      <div className="border-b bg-background/95 px-3 py-2 backdrop-blur">
        {toolbar}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className={cn("hidden h-full lg:grid", desktopGridClassName)}>
          <section className="min-h-0 overflow-hidden">{mainContent}</section>

          {panelOpen ? (
            <aside className="min-h-0 border-l bg-background shadow-[-16px_0_32px_-28px_rgba(15,23,42,0.5)]">
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{panelTitle}</p>
                  {panelDescription ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {panelDescription}
                    </p>
                  ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  {sidePanel}
                </div>
              </div>
            </aside>
          ) : null}
        </div>

        <div className="h-full lg:hidden">{mainContent}</div>
      </div>

      <Sheet open={panelOpen} onOpenChange={onPanelOpenChange}>
        <SheetContent side="right" className="w-full max-w-[420px] p-0 lg:hidden">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle>{panelTitle}</SheetTitle>
            {panelDescription ? (
              <SheetDescription>{panelDescription}</SheetDescription>
            ) : null}
          </SheetHeader>
          <div className="h-[calc(100vh-4.75rem)] overflow-y-auto px-4 py-4">
            {sidePanelPlaceholder || sidePanel}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}