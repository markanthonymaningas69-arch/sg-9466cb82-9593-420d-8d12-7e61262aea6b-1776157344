import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Bot, List, Loader2, Minus, Send, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

type DockMode = "float" | "left" | "right" | "bottom-left" | "bottom-right";
type ResizeMode = "right" | "bottom" | "corner";

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
}

const MARGIN = 16;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 420;
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 620;
const MAX_THREADS = 20;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getViewport() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getDockedState(dock: DockMode, current: WindowState): WindowState {
  const viewport = getViewport();
  const width = clamp(current.width, MIN_WIDTH, Math.max(MIN_WIDTH, viewport.width - MARGIN * 2));
  const height =
    dock === "left" || dock === "right"
      ? clamp(viewport.height - MARGIN * 2, MIN_HEIGHT, viewport.height - MARGIN * 2)
      : clamp(current.height, MIN_HEIGHT, Math.max(MIN_HEIGHT, viewport.height - MARGIN * 2));

  if (dock === "left") {
    return { ...current, dock, width, height, x: MARGIN, y: MARGIN };
  }

  if (dock === "right") {
    return { ...current, dock, width, height, x: viewport.width - width - MARGIN, y: MARGIN };
  }

  if (dock === "bottom-left") {
    return { ...current, dock, width, height, x: MARGIN, y: viewport.height - height - MARGIN };
  }

  return { ...current, dock: "bottom-right", width, height, x: viewport.width - width - MARGIN, y: viewport.height - height - MARGIN };
}

function constrainWindow(state: WindowState): WindowState {
  const viewport = getViewport();
  const width = clamp(state.width, MIN_WIDTH, Math.max(MIN_WIDTH, viewport.width - MARGIN * 2));
  const height = clamp(state.height, MIN_HEIGHT, Math.max(MIN_HEIGHT, viewport.height - MARGIN * 2));

  return {
    ...state,
    width,
    height,
    x: clamp(state.x, MARGIN, Math.max(MARGIN, viewport.width - width - MARGIN)),
    y: clamp(state.y, MARGIN, Math.max(MARGIN, viewport.height - height - MARGIN)),
  };
}

function getSnapDock(state: WindowState): DockMode {
  const viewport = getViewport();
  const nearLeft = state.x <= SNAP_DISTANCE;
  const nearRight = viewport.width - (state.x + state.width) <= SNAP_DISTANCE;
  const nearBottom = viewport.height - (state.y + state.height) <= SNAP_DISTANCE;

  if (nearLeft && nearBottom) return "bottom-left";
  if (nearRight && nearBottom) return "bottom-right";
  if (nearLeft) return "left";
  if (nearRight) return "right";
  return "float";
}

function getDefaultWindowState(): WindowState {
  if (typeof window === "undefined") {
    return {
      x: 0,
      y: 0,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      collapsed: true,
    };
  }

  return constrainWindow({
    x: window.innerWidth - DEFAULT_WIDTH - MARGIN,
    y: window.innerHeight - DEFAULT_HEIGHT - MARGIN,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    collapsed: true,
  });
}

export function AIChatAssistant() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const currentTab = typeof router.query.tab === "string" ? router.query.tab : null;
  const currentProjectId = typeof router.query.projectId === "string" ? router.query.projectId : typeof router.query.id === "string" ? router.query.id : null;
  const currentModule = getModuleLabel(router.pathname);
  const routeContextKey = [router.pathname, currentTab || "", currentProjectId || ""].join("::");

  const [storageKey, setStorageKey] = useState("ai_assistant_window_anon");
  const [threadKey, setThreadKey] = useState("ai_threads_anon");
  const [windowState, setWindowState] = useState<WindowState>(getDefaultWindowState);
  const [isReady, setIsReady] = useState(false);
  const [showThreads, setShowThreads] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [projectData, setProjectData] = useState<Record<string, unknown>>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const dragRef = useRef({ offsetX: 0, offsetY: 0 });
  const resizeRef = useRef({ mode: "corner" as ResizeMode, width: 0, height: 0, x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id || "anon";
      setStorageKey(`ai_assistant_window_${userId}`);
      setThreadKey(`ai_threads_${userId}`);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(storageKey);
    const base = getDefaultWindowState();

    if (!saved) {
      setWindowState(base);
      setIsReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Partial<WindowState>;
      setWindowState(
        constrainWindow({
          x: typeof parsed.x === "number" ? parsed.x : base.x,
          y: typeof parsed.y === "number" ? parsed.y : base.y,
          width: typeof parsed.width === "number" ? parsed.width : base.width,
          height: typeof parsed.height === "number" ? parsed.height : base.height,
          collapsed: typeof parsed.collapsed === "boolean" ? parsed.collapsed : base.collapsed,
        })
      );
    } catch {
      setWindowState(base);
    } finally {
      setIsReady(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!isReady || typeof window === "undefined" || isMobile) return;
    localStorage.setItem(storageKey, JSON.stringify(windowState));
  }, [isReady, isMobile, storageKey, windowState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(threadKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as ChatThread[];
      setThreads(parsed);
    } catch {
      setThreads([]);
    }
  }, [threadKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(threadKey, JSON.stringify(threads));
  }, [threadKey, threads]);

  useEffect(() => {
    if (scrollRef.current && !showThreads) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showThreads, windowState.collapsed]);

  useEffect(() => {
    if (!windowState.collapsed && !showThreads && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showThreads, windowState.collapsed]);

  useEffect(() => {
    setIsDataLoaded(false);
  }, [routeContextKey]);

  useEffect(() => {
    if (!windowState.collapsed && !isDataLoaded) {
      void loadData();
    }
  }, [isDataLoaded, windowState.collapsed]);

  useEffect(() => {
    if (typeof window === "undefined" || isMobile) return;
    const handleResize = () => setWindowState((current) => constrainWindow(current));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

  async function loadData() {
    const [vouchers, ledger, liquidations, personnel, inventory, purchases, projects, deliveries, consumptions, requests, advances, leaves, tasks, attendance, progress] = await Promise.all([
      supabase.from("vouchers").select("*").limit(200),
      supabase.from("accounting_transactions").select("*").order("date", { ascending: false }).limit(200),
      supabase.from("liquidations").select("*").order("date", { ascending: false }).limit(200),
      supabase.from("personnel").select("*").limit(200),
      supabase.from("inventory").select("*").limit(400),
      supabase.from("purchases").select("*").order("order_date", { ascending: false }).limit(200),
      supabase.from("projects").select("*"),
      supabase.from("deliveries").select("*").order("delivery_date", { ascending: false }).limit(200),
      supabase.from("material_consumption").select("*").eq("is_archived", false).order("date_used", { ascending: false }).limit(300),
      supabase.from("site_requests").select("*").order("request_date", { ascending: false }).limit(200),
      supabase.from("cash_advance_requests").select("*").order("request_date", { ascending: false }).limit(200),
      supabase.from("leave_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("project_tasks").select("*").order("sort_order", { ascending: true }).limit(500),
      supabase.from("site_attendance").select("*").order("date", { ascending: false }).limit(300),
      supabase.from("bom_progress_updates").select("*").order("update_date", { ascending: false }).limit(300),
    ]);

    setProjectData({
      accounting: vouchers.data || [],
      ledger: ledger.data || [],
      liquidations: liquidations.data || [],
      personnel: personnel.data || [],
      warehouse: inventory.data || [],
      purchases: purchases.data || [],
      projects: projects.data || [],
      deliveries: deliveries.data || [],
      materialConsumption: consumptions.data || [],
      siteRequests: requests.data || [],
      cashAdvances: advances.data || [],
      leaveRequests: leaves.data || [],
      tasks: tasks.data || [],
      attendance: attendance.data || [],
      progress: progress.data || [],
    });
    setIsDataLoaded(true);
  }

  const floatingButtonStyle = useMemo(() => {
    if (isMobile) return undefined;
    return { left: windowState.x, top: windowState.y };
  }, [isMobile, windowState.x, windowState.y]);

  function persistThread(newMessages: Message[]) {
    setThreads((current) => {
      const nextId = currentThreadId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const title = (newMessages[0]?.content || "New chat").slice(0, 36);
      const nextThread: ChatThread = { id: nextId, title, messages: newMessages, updatedAt: new Date().toISOString() };
      setCurrentThreadId(nextId);
      return [nextThread, ...current.filter((thread) => thread.id !== nextId)].slice(0, MAX_THREADS);
    });
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { role: "user", content: input.trim(), timestamp: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content, projectData, conversationHistory: messages.slice(-10), uiContext: { module: currentModule, tab: currentTab, pathname: router.pathname, projectId: currentProjectId } }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to get AI response");
      const assistantMessage: Message = { role: "assistant", content: data.message, timestamp: new Date().toISOString() };
      const updated = [...nextMessages, assistantMessage];
      setMessages(updated);
      persistThread(updated);
    } catch (error) {
      const fallback: Message = { role: "assistant", content: error instanceof Error ? `Error: ${error.message}` : "Error while processing your request.", timestamp: new Date().toISOString() };
      setMessages([...nextMessages, fallback]);
    } finally {
      setIsLoading(false);
    }
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, input")) return;
    dragRef.current = { offsetX: event.clientX - windowState.x, offsetY: event.clientY - windowState.y };
    setIsDragging(true);

    const move = (moveEvent: PointerEvent) => {
      setWindowState((current) =>
        constrainWindow({
          ...current,
          x: moveEvent.clientX - dragRef.current.offsetX,
          y: moveEvent.clientY - dragRef.current.offsetY,
        })
      );
    };

    const up = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(mode: ResizeMode, event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { mode, width: windowState.width, height: windowState.height, x: event.clientX, y: event.clientY };

    const move = (moveEvent: PointerEvent) => {
      const widthDelta = moveEvent.clientX - resizeRef.current.x;
      const heightDelta = moveEvent.clientY - resizeRef.current.y;
      setWindowState((current) =>
        constrainWindow({
          ...current,
          width: resizeRef.current.width + (mode === "bottom" ? 0 : widthDelta),
          height: resizeRef.current.height + (mode === "right" ? 0 : heightDelta),
        })
      );
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function openThread(thread: ChatThread) {
    setCurrentThreadId(thread.id);
    setMessages(thread.messages);
    setShowThreads(false);
    setWindowState((current) => ({ ...current, collapsed: false }));
  }

  function newChat() {
    setCurrentThreadId(null);
    setMessages([]);
    setShowThreads(false);
  }

  const panel = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
      <div className={cn("flex h-12 items-center justify-between border-b bg-gradient-to-r from-blue-600 to-purple-600 px-3 text-white", !isMobile && "cursor-move")} onPointerDown={isMobile ? undefined : startDrag}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="h-4 w-4" />
          <span>AI Project Expert</span>
          {isDragging ? <span className="text-[10px] opacity-80">Dragging</span> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => setShowThreads((current) => !current)}><List className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => setWindowState((current) => ({ ...current, collapsed: true }))}><Minus className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => setWindowState((current) => ({ ...current, collapsed: true }))}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {showThreads ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b p-3"><Button type="button" className="w-full" onClick={newChat}>New Chat</Button></div>
            <div className="min-h-0 flex-1 overflow-auto p-3 space-y-2">
              {threads.length === 0 ? <p className="text-center text-sm text-muted-foreground">No chat history yet.</p> : threads.map((thread) => (
                <div key={thread.id} className="rounded-lg border p-3 hover:border-primary">
                  <button type="button" className="w-full text-left" onClick={() => openThread(thread)}>
                    <p className="truncate text-sm font-medium">{thread.title}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(thread.updatedAt).toLocaleString()}</p>
                  </button>
                  <Button type="button" variant="ghost" size="icon" className="mt-2 h-7 w-7" onClick={() => setThreads((current) => current.filter((item) => item.id !== thread.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4">
              {messages.length === 0 ? (
                <div className="space-y-3 py-8 text-center text-muted-foreground">
                  <Bot className="mx-auto h-10 w-10 opacity-50" />
                  <p className="text-sm">Ask for project, cost, manpower, schedule, or site analysis.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div key={`${message.timestamp}-${index}`} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                      {message.role === "assistant" ? <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></div> : null}
                      <div className={cn("max-w-[85%] rounded-lg p-3 text-sm shadow-sm", message.role === "user" ? "bg-primary text-primary-foreground" : "border bg-card")}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p className={cn("mt-1 text-[10px]", message.role === "user" ? "text-primary-foreground/80" : "text-muted-foreground")}>{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      {message.role === "user" ? <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><User className="h-4 w-4" /></div> : null}
                    </div>
                  ))}
                  {isLoading ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analyzing module data...</div> : null}
                </div>
              )}
            </div>
            <div className="border-t p-3">
              <div className="flex gap-2">
                <Input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={`Ask about ${currentModule}...`} disabled={isLoading} className="h-10" />
                <Button type="button" size="icon" onClick={() => void sendMessage()} disabled={!input.trim() || isLoading}><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}

        {!isMobile ? (
          <>
            <div className="absolute right-0 top-12 h-[calc(100%-3rem)] w-1 cursor-ew-resize" onPointerDown={(event) => startResize("right", event)} />
            <div className="absolute bottom-0 left-0 h-1 w-full cursor-ns-resize" onPointerDown={(event) => startResize("bottom", event)} />
            <div className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize" onPointerDown={(event) => startResize("corner", event)} />
          </>
        ) : null}
      </div>
    </div>
  );

  if (!isReady) {
    return null;
  }

  if (isMobile) {
    return (
      <>
        <Button type="button" onClick={() => setWindowState((current) => ({ ...current, collapsed: false }))} size="lg" className="fixed bottom-4 right-4 z-50 h-12 rounded-full px-4 shadow-xl">
          <Bot className="mr-2 h-4 w-4" />
          AI Assistant
        </Button>
        {!windowState.collapsed ? <div className="fixed inset-0 z-50 bg-black/40 p-4"><div className="h-full w-full">{panel}</div></div> : null}
      </>
    );
  }

  if (windowState.collapsed) {
    return (
      <Button type="button" onClick={() => setWindowState((current) => ({ ...current, collapsed: false }))} className="fixed z-50 h-12 rounded-full px-4 shadow-xl" style={floatingButtonStyle}>
        <Bot className="mr-2 h-4 w-4" />
        AI Expert
      </Button>
    );
  }

  return (
    <div className="fixed z-50" style={{ left: windowState.x, top: windowState.y, width: windowState.width, height: windowState.height }}>
      {panel}
    </div>
  );
}