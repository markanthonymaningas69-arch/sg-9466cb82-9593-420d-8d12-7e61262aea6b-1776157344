import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Bot, User, Loader2, MessageSquare, Minus, Maximize2, List, Plus, Pencil, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
  updated_at: string;
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

export function AIChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showThreads, setShowThreads] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [projectData, setProjectData] = useState<any>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const router = useRouter();
  const currentTab = typeof router.query.tab === "string" ? router.query.tab : null;
  const currentProjectId =
    typeof router.query.projectId === "string"
      ? router.query.projectId
      : typeof router.query.id === "string"
        ? router.query.id
        : null;
  const currentModule = getModuleLabel(router.pathname);
  const routeContextKey = [router.pathname, currentTab || "", currentProjectId || ""].join("::");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current && !showThreads) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showThreads, isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized && !showThreads && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized, showThreads]);

  useEffect(() => {
    if (isOpen) {
      setIsDataLoaded(false);
    }
  }, [isOpen, routeContextKey]);

  useEffect(() => {
    if (isOpen && !isDataLoaded) {
      loadData();
      loadThreads();
    }
  }, [isOpen, isDataLoaded]);

  const loadData = async () => {
    try {
      const [
        acct,
        ledg,
        liq,
        pers,
        inv,
        purch,
        projs,
        deliveries,
        consumptions,
        requests,
        advances,
        leaves,
        scheduleTasks,
        attendance,
        progressUpdates,
        bomScopes,
        bomMaterials,
        bomIndirectCosts,
      ] = await Promise.all([
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
        supabase.from("bom_scope_of_work").select("*").limit(300),
        supabase.from("bom_materials").select("*").limit(500),
        supabase.from("bom_indirect_costs").select("*").limit(200),
      ]);

      const allProjects = projs.data || [];
      const focusedProject = currentProjectId
        ? allProjects.find((project: { id: string }) => project.id === currentProjectId) || null
        : null;

      setProjectData({
        accounting: acct.data || [],
        ledger: ledg.data || [],
        liquidations: liq.data || [],
        personnel: pers.data || [],
        warehouse: inv.data || [],
        purchases: purch.data || [],
        allProjects,
        deliveries: deliveries.data || [],
        materialConsumption: consumptions.data || [],
        siteRequests: requests.data || [],
        cashAdvances: advances.data || [],
        leaveRequests: leaves.data || [],
        scheduleTasks: scheduleTasks.data || [],
        siteAttendance: attendance.data || [],
        progressUpdates: progressUpdates.data || [],
        bomScopes: bomScopes.data || [],
        bomMaterials: bomMaterials.data || [],
        bomIndirectCosts: bomIndirectCosts.data || [],
        focusedProject,
      });
      setIsDataLoaded(true);
    } catch (error) {
      console.error("Failed to load AI context data:", error);
    }
  };

  const MAX_THREADS = 20;

  const getStorageKey = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return `ai_threads_${session?.user?.id || 'anon'}`;
  };

  const loadThreads = async () => {
    const key = await getStorageKey();
    const saved = localStorage.getItem(key);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const restored = parsed.map((t: any) => ({
          ...t,
          messages: t.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        }));
        setThreads(restored);
      } catch (e) {
        console.error("Failed to parse local threads", e);
      }
    }
  };

  const saveThread = async (newMessages: Message[]) => {
    const key = await getStorageKey();
    let updatedThreads = [...threads];

    if (!currentThreadId && newMessages.length > 0) {
      const title = newMessages[0].content.substring(0, 30) + "...";
      const newThreadId = Date.now().toString() + Math.random().toString(36).substring(2);
      
      const newThread: ChatThread = {
        id: newThreadId,
        title,
        messages: newMessages,
        updated_at: new Date().toISOString()
      };
      
      setCurrentThreadId(newThreadId);
      updatedThreads = [newThread, ...updatedThreads];
    } else if (currentThreadId) {
      updatedThreads = updatedThreads.map(t => 
        t.id === currentThreadId 
          ? { ...t, messages: newMessages, updated_at: new Date().toISOString() }
          : t
      );
      // Sort to bring recently updated thread to the top
      updatedThreads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }

    // Auto-delete old threads to save browser memory
    if (updatedThreads.length > MAX_THREADS) {
      updatedThreads = updatedThreads.slice(0, MAX_THREADS);
    }

    setThreads(updatedThreads);
    localStorage.setItem(key, JSON.stringify(updatedThreads));
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          projectData,
          conversationHistory: messages.slice(-10),
          uiContext: {
            module: currentModule,
            tab: currentTab,
            pathname: router.pathname,
            projectId: currentProjectId,
          },
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get AI response");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date()
      };

      const updatedMessages = [...currentMessages, assistantMessage];
      setMessages(updatedMessages);
      await saveThread(updatedMessages);
      
    } catch (error) {
      console.error("AI Chat Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: error instanceof Error 
          ? `Error: ${error.message}`
          : "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages([...currentMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const deleteThread = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    const key = await getStorageKey();
    const updatedThreads = threads.filter(t => t.id !== threadId);
    setThreads(updatedThreads);
    localStorage.setItem(key, JSON.stringify(updatedThreads));
    if (currentThreadId === threadId) {
      setCurrentThreadId(null);
      setMessages([]);
    }
  };

  const startEditing = (e: React.MouseEvent, thread: ChatThread) => {
    e.stopPropagation();
    setEditingThreadId(thread.id);
    setEditTitle(thread.title);
  };

  const saveTitle = async (e: React.MouseEvent | React.KeyboardEvent | React.FocusEvent, threadId: string) => {
    e.stopPropagation();
    if (!editTitle.trim()) {
      setEditingThreadId(null);
      return;
    }
    const key = await getStorageKey();
    const updatedThreads = threads.map(t => 
      t.id === threadId ? { ...t, title: editTitle.trim() } : t
    );
    setThreads(updatedThreads);
    localStorage.setItem(key, JSON.stringify(updatedThreads));
    setEditingThreadId(null);
  };

  const startNewChat = () => {
    setCurrentThreadId(null);
    setMessages([]);
    setShowThreads(false);
  };

  const selectThread = (thread: ChatThread) => {
    setCurrentThreadId(thread.id);
    setMessages(thread.messages);
    setShowThreads(false);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-12 sm:h-14 px-4 sm:px-6 shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 z-50 text-sm sm:text-base rounded-full"
      >
        <Bot className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
        <span className="hidden sm:inline">AI Project Expert</span>
        <span className="sm:hidden">AI Expert</span>
      </Button>
    );
  }

  return (
    <Card className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] shadow-2xl z-50 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${isMinimized ? 'h-[52px]' : 'h-[500px] sm:h-[600px]'}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 h-[52px] border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white cursor-pointer select-none"
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <div>
            <h3 className="font-semibold text-sm leading-none">AI Project Expert</h3>
            {!isMinimized && <p className="text-[10px] opacity-90 mt-0.5">Global System Analysis</p>}
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {!isMinimized && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowThreads(!showThreads)}
              className={`hover:bg-white/20 text-white h-8 w-8 ${showThreads ? 'bg-white/20' : ''}`}
            >
              <List className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="hover:bg-white/20 text-white h-8 w-8"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="hover:bg-white/20 text-white h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Main Area */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Threads Sidebar / Overlay */}
            {showThreads ? (
              <div className="absolute inset-0 z-10 bg-background flex flex-col">
                <div className="p-4 border-b">
                  <Button onClick={startNewChat} className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
                    <Plus className="mr-2 h-4 w-4" /> New Chat
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {threads.length === 0 ? (
                      <p className="text-sm text-center text-muted-foreground py-4">No chat history yet.</p>
                    ) : (
                      threads.map(t => (
                        <div 
                          key={t.id} 
                          onClick={() => selectThread(t)}
                          className={`p-3 text-sm rounded-lg border cursor-pointer hover:border-primary transition-colors group ${currentThreadId === t.id ? 'bg-primary/5 border-primary' : 'bg-card'}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            {editingThreadId === t.id ? (
                              <div className="flex-1 flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
                                <Input 
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && saveTitle(e, t.id)}
                                  onBlur={(e) => saveTitle(e, t.id)}
                                  className="h-7 text-xs px-2"
                                  autoFocus
                                />
                                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-green-600 hover:bg-green-50 hover:text-green-700" onClick={(e) => saveTitle(e, t.id)}>
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="font-medium truncate flex-1">{t.title}</div>
                            )}
                            
                            {editingThreadId !== t.id && (
                              <div className="flex gap-1 shrink-0">
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:bg-muted hover:text-primary" onClick={(e) => startEditing(e, t)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:bg-red-50 hover:text-destructive" onClick={(e) => deleteThread(e, t.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {new Date(t.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              /* Messages Area */
              <ScrollArea className="flex-1 p-4 bg-muted/20" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 space-y-3">
                    <Bot className="h-12 w-12 mx-auto opacity-50" />
                    <p className="text-sm">I can analyze data across all modules and tabs, including the page you are currently viewing.</p>
                    <div className="text-xs space-y-1 text-left bg-background border p-3 rounded-lg shadow-sm">
                      <p className="font-medium">Try asking:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Give me an overview of all projects.</li>
                        <li>Analyze this module and tab based on the data currently loaded.</li>
                        <li>Compare Project Manager schedules with Site Personnel progress and warehouse usage.</li>
                        <li>Summarize pending vouchers, liquidations, deliveries, and requests.</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.role === "assistant" && (
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-sm">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div className={`max-w-[85%] rounded-lg p-3 shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          <p className={`text-[10px] opacity-70 mt-1 ${msg.role === "user" ? "text-primary-foreground/80 text-right" : "text-muted-foreground"}`}>
                            {msg.timestamp.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-sm">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-card border rounded-lg p-4 flex items-center shadow-sm">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="ml-2 text-xs text-muted-foreground">Analyzing system data...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t bg-card">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask the AI Project Expert..."
                disabled={isLoading || showThreads}
                className="flex-1 focus-visible:ring-1 bg-muted/50"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || showThreads}
                size="icon"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shrink-0 shadow-sm"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}