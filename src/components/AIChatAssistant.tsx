import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Bot, User, Loader2, MessageSquare, Minus, Maximize2, List, Plus } from "lucide-react";
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
    if (isOpen && !isDataLoaded) {
      loadData();
      loadThreads();
    }
  }, [isOpen, isDataLoaded]);

  const loadData = async () => {
    try {
      const [acct, ledg, liq, pers, inv, purch, projs] = await Promise.all([
        supabase.from('vouchers').select('*').limit(100),
        supabase.from('accounting_transactions').select('*').order('date', { ascending: false }).limit(100),
        supabase.from('liquidations').select('*').order('date', { ascending: false }).limit(100),
        supabase.from('personnel').select('*').limit(100),
        supabase.from('inventory').select('*').limit(100),
        supabase.from('purchases').select('*').order('order_date', { ascending: false }).limit(100),
        supabase.from('projects').select('*')
      ]);
      setProjectData({
        accounting: acct.data || [],
        ledger: ledg.data || [],
        liquidations: liq.data || [],
        personnel: pers.data || [],
        warehouse: inv.data || [],
        purchases: purch.data || [],
        allProjects: projs.data || []
      });
      setIsDataLoaded(true);
    } catch (error) {
      console.error("Failed to load AI context data:", error);
    }
  };

  const loadThreads = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data } = await supabase
      .from('ai_chat_threads')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });
    
    if (data) {
      const parsed = data.map(t => ({
        ...t,
        messages: (t.messages as any[]).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
      }));
      setThreads(parsed);
    }
  };

  const saveThread = async (newMessages: Message[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Convert messages to a simple object array for JSON storage
    const messagesJson = JSON.parse(JSON.stringify(newMessages));

    if (!currentThreadId && newMessages.length > 0) {
      const title = newMessages[0].content.substring(0, 30) + "...";
      const { data } = await supabase.from('ai_chat_threads').insert({
        user_id: session.user.id,
        title,
        messages: messagesJson
      }).select().single();
      
      if (data) {
        setCurrentThreadId(data.id);
        setThreads(prev => [{
          ...data,
          messages: (data.messages as any[]).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        }, ...prev]);
      }
    } else if (currentThreadId) {
      await supabase.from('ai_chat_threads').update({
        messages: messagesJson,
        updated_at: new Date().toISOString()
      }).eq('id', currentThreadId);
      
      setThreads(prev => prev.map(t => 
        t.id === currentThreadId 
          ? { ...t, messages: newMessages, updated_at: new Date().toISOString() }
          : t
      ));
    }
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
          conversationHistory: messages.slice(-10)
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
                          className={`p-3 text-sm rounded-lg border cursor-pointer hover:border-primary transition-colors ${currentThreadId === t.id ? 'bg-primary/5 border-primary' : 'bg-card'}`}
                        >
                          <div className="font-medium truncate">{t.title}</div>
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
                    <p className="text-sm">I am your AI Project Expert. I have access to your entire system!</p>
                    <div className="text-xs space-y-1 text-left bg-background border p-3 rounded-lg shadow-sm">
                      <p className="font-medium">Try asking:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Give me an overview of all projects.</li>
                        <li>What is our current ledger balance?</li>
                        <li>Are there any low stock items?</li>
                        <li>Summarize pending vouchers and liquidations.</li>
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