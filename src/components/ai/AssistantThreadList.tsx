import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AssistantThread } from "@/lib/aiAssistantCache";

interface AssistantThreadListProps {
  threads: AssistantThread[];
  activeThreadId: string;
  editingThreadId: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onCreateThread: () => void;
  onSelectThread: (threadId: string) => void;
  onStartRename: (thread: AssistantThread) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDeleteThread: (threadId: string) => void;
}

export function AssistantThreadList({
  threads,
  activeThreadId,
  editingThreadId,
  renameValue,
  onRenameValueChange,
  onCreateThread,
  onSelectThread,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDeleteThread,
}: AssistantThreadListProps) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r bg-background">
      <div className="flex items-center justify-between border-b px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">History</p>
          <p className="text-[11px] text-muted-foreground">{threads.length} thread{threads.length === 1 ? "" : "s"}</p>
        </div>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={onCreateThread}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isEditing = thread.id === editingThreadId;

          return (
            <div
              key={thread.id}
              className={cn(
                "rounded-xl border p-2 transition-colors",
                isActive ? "border-primary bg-primary/5" : "border-border bg-card"
              )}
            >
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={renameValue}
                    onChange={(event) => onRenameValueChange(event.target.value)}
                    className="h-8 text-xs"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onSaveRename}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onCancelRename}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onSelectThread(thread.id)}
                  >
                    <p className="truncate text-sm font-medium text-foreground">{thread.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {thread.messages.at(-1)?.content || "No messages yet"}
                    </p>
                  </button>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onStartRename(thread)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDeleteThread(thread.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}