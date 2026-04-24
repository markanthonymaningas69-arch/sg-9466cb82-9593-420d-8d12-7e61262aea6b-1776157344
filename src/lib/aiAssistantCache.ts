import { CACHE_TTL, cacheManager } from "@/lib/cache";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface AssistantThread {
  id: string;
  title: string;
  messages: AssistantMessage[];
  updatedAt: string;
}

const THREAD_TTL = CACHE_TTL.REPORT;

function buildThreadKey(userId: string, routeContextKey: string) {
  return "AIThreads_" + userId + "_" + routeContextKey;
}

export function createAssistantThread(title = "New thread"): AssistantThread {
  const timestamp = new Date().toISOString();

  return {
    id: "thread_" + timestamp + "_" + Math.random().toString(36).slice(2, 8),
    title,
    messages: [],
    updatedAt: timestamp,
  };
}

export function getAssistantThreads(userId: string, routeContextKey: string) {
  return cacheManager.get<AssistantThread[]>(buildThreadKey(userId, routeContextKey));
}

export function setAssistantThreads(userId: string, routeContextKey: string, threads: AssistantThread[]) {
  cacheManager.set(buildThreadKey(userId, routeContextKey), threads, THREAD_TTL);
}