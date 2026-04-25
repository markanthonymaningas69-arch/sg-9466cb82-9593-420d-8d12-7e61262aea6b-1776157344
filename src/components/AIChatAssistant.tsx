import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Bot, List, Loader2, Minus, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  createAssistantThread,
  getAssistantThreads,
  setAssistantThreads,
  type AssistantMessage,
  type AssistantThread,
} from "@/lib/aiAssistantCache";
import { AssistantThreadList } from "@/components/ai/AssistantThreadList";

interface AIChatAssistantProps {
  contained?: boolean;
}

function buildThreadTitle(content: string) {
  const trimmed = content.trim();
  return trimmed.length > 30 ? trimmed.slice(0, 30) + "..." : trimmed || "New thread";
}

export function AIChatAssistant({ contained = false }: AIChatAssistantProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTab = typeof router.query.tab === "string" ? router.query.tab : null;
  const currentProjectId =
    typeof router.query.projectId === "string"
      ? router.query.projectId
      : typeof router.query.id === "string"
        ? router.query.id
        : null;

  const currentModule = "GM";
  const globalContextKey = "gm-global";

  const [userId, setUserId] = useState("anon");
  const [collapsed, setCollapsed] = useState(false);
  const [showThreads, setShowThreads] = useState(true);
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [projectData, setProjectData] = useState<Record<string, unknown>>({});

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || threads[0] || null,
    [activeThreadId, threads]
  );

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || "anon");
    });
  }, []);

  useEffect(() => {
    const cachedThreads = getAssistantThreads(userId, globalContextKey);
    const nextThreads =
      cachedThreads && cachedThreads.length > 0
        ? cachedThreads
        : [createAssistantThread("GM thread")];
    setThreads(nextThreads);
    setActiveThreadId(nextThreads[0].id);
    setEditingThreadId(null);
    setRenameValue("");
  }, [globalContextKey, userId]);

  useEffect(() => {
    if (threads.length > 0) {
      setAssistantThreads(userId, globalContextKey, threads);
    }
  }, [globalContextKey, threads, userId]);

  useEffect(() => {
    void loadData();
  }, [currentProjectId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeThread?.messages, isLoading]);

  async function loadData() {
    setIsDataLoading(true);

    const [
      vouchers,
      ledger,
      liquidations,
      personnel,
      inventory,
      purchases,
      projects,
      deliveries,
      consumptions,
      requests,
      advances,
      leaves,
      tasks,
      attendance,
      progress,
    ] = await Promise.all([
      supabase.from("vouchers").select("*").order("date", { ascending: false }).limit(200),
      supabase.from("accounting_transactions").select("*").order("date", { ascending: false }).limit(200),
      supabase.from("liquidations").select("*").order("date", { ascending: false }).limit(200),
      supabase.from("personnel").select("*").limit(200),
      supabase.from("inventory").select("*").limit(400),
      supabase.from("purchases").select("*").order("order_date", { ascending: false }).limit(200),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("deliveries").select("*").order("delivery_date", { ascending: false }).limit(200),
      supabase.from("material_consumption").select("*").eq("is_archived", false).order("date_used", { ascending: false }).limit(300),
      supabase.from("site_requests").select("*").order("request_date", { ascending: false }).limit(200),
      supabase.from("cash_advance_requests").select("*").order("request_date", { ascending: false }).limit(200),
      supabase.from("leave_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("project_tasks").select("*").order("sort_order", { ascending: true }).limit(500),
      supabase.from("site_attendance").select("*").order("date", { ascending: false }).limit(300),
      supabase.from("bom_progress_updates").select("*").order("update_date", { ascending: false }).limit(300),
    ]);

    const allProjects = Array.isArray(projects.data) ? projects.data : [];
    const focusedProject =
      currentProjectId && allProjects.length > 0
        ? allProjects.find((project) => String(project.id) === String(currentProjectId)) || null
        : null;

    setProjectData({
      accounting: Array.isArray(vouchers.data) ? vouchers.data : [],
      ledger: Array.isArray(ledger.data) ? ledger.data : [],
      liquidations: Array.isArray(liquidations.data) ? liquidations.data : [],
      personnel: Array.isArray(personnel.data) ? personnel.data : [],
      warehouse: Array.isArray(inventory.data) ? inventory.data : [],
      purchases: Array.isArray(purchases.data) ? purchases.data : [],
      allProjects,
      projects: allProjects,
      focusedProject,
      deliveries: Array.isArray(deliveries.data) ? deliveries.data : [],
      materialConsumption: Array.isArray(consumptions.data) ? consumptions.data : [],
      siteRequests: Array.isArray(requests.data) ? requests.data : [],
      cashAdvances: Array.isArray(advances.data) ? advances.data : [],
      leaveRequests: Array.isArray(leaves.data) ? leaves.data : [],
      scheduleTasks: Array.isArray(tasks.data) ? tasks.data : [],
      tasks: Array.isArray(tasks.data) ? tasks.data : [],
      siteAttendance: Array.isArray(attendance.data) ? attendance.data : [],
      attendance: Array.isArray(attendance.data) ? attendance.data : [],
      progressUpdates: Array.isArray(progress.data) ? progress.data : [],
      progress: Array.isArray(progress.data) ? progress.data : [],
    });

    setIsDataLoading(false);
  }

  function updateThread(threadId: string, updater: (thread: AssistantThread) => AssistantThread) {
    setThreads((current) => current.map((thread) => (thread.id === threadId ? updater(thread) : thread)));
  }

  function handleCreateThread() {
    const nextThread = createAssistantThread("GM thread");
    setThreads((current) => [nextThread, ...current].slice(0, 20));
    setActiveThreadId(nextThread.id);
    setEditingThreadId(null);
    setRenameValue("");
  }

  function handleStartRename(thread: AssistantThread) {
    setEditingThreadId(thread.id);
    setRenameValue(thread.title);
  }

  function handleSaveRename() {
    if (!editingThreadId) return;
    const nextTitle = renameValue.trim() || "Untitled thread";
    updateThread(editingThreadId, (thread) => ({ ...thread, title: nextTitle }));
    setEditingThreadId(null);
    setRenameValue("");
  }

  function handleDeleteThread(threadId: string) {
    const remaining = threads.filter((thread) => thread.id !== threadId);
    const nextThreads = remaining.length > 0 ? remaining : [createAssistantThread("GM thread")];
    setThreads(nextThreads);
    setActiveThreadId(nextThreads[0].id);
    setEditingThreadId(null);
    setRenameValue("");
  }

  async function sendMessage() {
    if (!input.trim() || isLoading || !activeThread) return;

    const userMessage: AssistantMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const pendingMessages = [...activeThread.messages, userMessage];
    updateThread(activeThread.id, (thread) => ({
      ...thread,
      title: thread.messages.length === 0 ? buildThreadTitle(userMessage.content) : thread.title,
      messages: pendingMessages,
      updatedAt: userMessage.timestamp,
    }));

    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          projectData,
          conversationHistory: pendingMessages.slice(-8),
          uiContext: {
            module: currentModule,
            tab: currentTab,
            pathname: router.pathname,
            projectId: currentProjectId,
          },
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to get AI response");
      }

      const assistantMessage: AssistantMessage = {
        role: "assistant",
        content: data.message || "No response received.",
        timestamp: new Date().toISOString(),
      };

      updateThread(activeThread.id, (thread) => ({
        ...thread,
        messages: [...pendingMessages, assistantMessage],
        updatedAt: assistantMessage.timestamp,
      }));
    } catch (error) {
      const fallback: AssistantMessage = {
        role: "assistant",
        content: error instanceof Error ? "Error: " + error.message : "Error while processing your request.",
        timestamp: new Date().toISOString(),
      };

      updateThread(activeThread.id, (thread) => ({
        ...thread,
        messages: [...pendingMessages, fallback],
        updatedAt: fallback.timestamp,
      }));
    } finally {
      setIsLoading(false);
    }
  }

  const panel = (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-xl flex flex-col", showThreads ? "w-[calc(100vw-2rem)] sm:w-[640px]" : "w-[calc(100vw-2rem)] sm:w-[440px]")}>
      <div className="flex h-12 shrink-0 items-center justify-between border-b bg-primary px-4 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">AI Project Assistant</p>
            <p className="mt-1 text-[11px] text-primary-foreground/80">GM global analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground" onClick={() => setShowThreads((current) => !current)}>
            <List className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground" onClick={() => setCollapsed(true)}>
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-10rem)] max-h-[540px] min-h-[300px]">
        {showThreads ? (
          <AssistantThreadList
            threads={threads}
            activeThreadId={activeThread?.id || ""}
            editingThreadId={editingThreadId}
            renameValue={renameValue}
            onRenameValueChange={setRenameValue}
            onCreateThread={handleCreateThread}
            onSelectThread={setActiveThreadId}
            onStartRename={handleStartRename}
            onSaveRename={handleSaveRename}
            onCancelRename={() => {
              setEditingThreadId(null);
              setRenameValue("");
            }}
            onDeleteThread={handleDeleteThread}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/20 px-4 py-4">
            {!activeThread || activeThread.messages.length === 0 ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center text-muted-foreground">
                <Bot className="mb-3 h-10 w-10 opacity-60" />
                <p className="text-sm font-medium">Ask about costs, progress, manpower, or project risks.</p>
                <p className="mt-1 text-xs">The assistant uses the current module data and active project context.</p>
              </div>
            ) : (
              activeThread.messages.map((message, index) => (
                <div key={message.timestamp + "-" + index} className={cn("flex w-full", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm", message.role === "user" ? "bg-primary text-primary-foreground" : "border bg-background text-foreground")}>
                    <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                    <p className={cn("mt-2 text-[10px]", message.role === "user" ? "text-primary-foreground/75" : "text-muted-foreground")}>
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}

            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing current module data...
              </div>
            ) : null}
          </div>

          <div className="border-t bg-background p-4">
            <div className="flex items-end gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask about GM projects, costs, manpower, or risks..."
                disabled={isLoading || isDataLoading || !activeThread}
                className="h-11"
              />
              <Button
                type="button"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || isLoading || isDataLoading || !activeThread}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {isDataLoading ? "Loading GM data..." : "Ready with GM-wide project data"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (collapsed) {
    const collapsedButton = (
      <Button type="button" onClick={() => setCollapsed(false)} className="h-11 rounded-full px-4 shadow-lg">
        <Bot className="mr-2 h-4 w-4" />
        AI Assistant
      </Button>
    );

    return contained ? (
      <div className="relative min-h-11 w-full">
        <div className="absolute bottom-0 right-0 z-20">
          {collapsedButton}
        </div>
      </div>
    ) : (
      <div className="fixed bottom-4 right-4 z-50">{collapsedButton}</div>
    );
  }

  return contained ? (
    <div className="relative min-h-11 w-full">
      <div className="absolute bottom-0 right-0 z-20">
        {panel}
      </div>
    </div>
  ) : (
    <div className="fixed bottom-4 right-4 z-50">{panel}</div>
  );
}