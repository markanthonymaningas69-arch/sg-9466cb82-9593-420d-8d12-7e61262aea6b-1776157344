import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Bot, Loader2, Minus, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AIChatAssistantProps {
  contained?: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

function getModuleLabel(pathname: string) {
  const routeMap: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/projects": "Project Profile",
    "/schedule": "Project Manager",
    "/site-personnel": "Site Personnel",
    "/purchasing": "Purchasing",
    "/accounting": "Accounting",
    "/personnel": "Human Resources",
    "/warehouse": "Warehouse",
    "/analytics": "Analytics",
    "/settings": "Settings",
    "/subscription": "Subscription",
    "/account": "Account Settings",
  };

  if (pathname.startsWith("/bom/")) {
    return "Project BOM";
  }

  return routeMap[pathname] || "Module";
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
  const currentModule = getModuleLabel(router.pathname);
  const routeContextKey = [router.pathname, currentTab || "", currentProjectId || ""].join("::");

  const [userId, setUserId] = useState("anon");
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [projectData, setProjectData] = useState<Record<string, unknown>>({});

  const collapsedKey = useMemo(
    () => `ai_assistant_collapsed_${userId}`,
    [userId]
  );

  const messageKey = useMemo(
    () => `ai_assistant_messages_${userId}_${routeContextKey}`,
    [routeContextKey, userId]
  );

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || "anon");
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(collapsedKey);
    setCollapsed(saved === "true");
  }, [collapsedKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(collapsedKey, String(collapsed));
  }, [collapsed, collapsedKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(messageKey);

    if (!saved) {
      setMessages([]);
      return;
    }

    try {
      setMessages(JSON.parse(saved) as Message[]);
    } catch {
      setMessages([]);
    }
  }, [messageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(messageKey, JSON.stringify(messages));
  }, [messageKey, messages]);

  useEffect(() => {
    void loadData();
  }, [routeContextKey]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading, collapsed]);

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

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
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
          conversationHistory: nextMessages.slice(-8),
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

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message || "No response received.",
        timestamp: new Date().toISOString(),
      };

      setMessages([...nextMessages, assistantMessage]);
    } catch (error) {
      const fallback: Message = {
        role: "assistant",
        content: error instanceof Error ? `Error: ${error.message}` : "Error while processing your request.",
        timestamp: new Date().toISOString(),
      };

      setMessages([...nextMessages, fallback]);
    } finally {
      setIsLoading(false);
    }
  }

  const panel = (
    <div className="flex h-[540px] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border bg-card shadow-xl">
      <div className="flex h-12 items-center justify-between border-b bg-primary px-4 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">AI Project Assistant</p>
            <p className="mt-1 text-[11px] text-primary-foreground/80">
              {currentModule} module analysis
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
          onClick={() => setCollapsed(true)}
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto bg-muted/20 px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center text-muted-foreground">
            <Bot className="mb-3 h-10 w-10 opacity-60" />
            <p className="text-sm font-medium">Ask about costs, progress, manpower, or project risks.</p>
            <p className="mt-1 text-xs">
              The assistant uses the current module context and available project records.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.timestamp}-${index}`}
              className={cn("flex w-full", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border bg-background text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                <p
                  className={cn(
                    "mt-2 text-[10px]",
                    message.role === "user"
                      ? "text-primary-foreground/75"
                      : "text-muted-foreground"
                  )}
                >
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
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
            placeholder={`Ask about ${currentModule.toLowerCase()}...`}
            disabled={isLoading || isDataLoading}
            className="h-11"
          />
          <Button
            type="button"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isLoading || isDataLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          {isDataLoading ? "Loading module data..." : `Data ready for ${currentModule}`}
        </p>
      </div>
    </div>
  );

  if (collapsed) {
    const collapsedButton = (
      <Button
        type="button"
        onClick={() => setCollapsed(false)}
        className="h-11 rounded-full px-4 shadow-lg"
      >
        <Bot className="mr-2 h-4 w-4" />
        AI Assistant
      </Button>
    );

    return contained ? (
      <div className="flex justify-end">{collapsedButton}</div>
    ) : (
      <div className="fixed bottom-4 right-4 z-50">{collapsedButton}</div>
    );
  }

  return contained ? (
    <div className="flex justify-end">{panel}</div>
  ) : (
    <div className="fixed bottom-4 right-4 z-50">{panel}</div>
  );
}