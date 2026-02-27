import { getCurrentUserId } from './api';

export type AIProjectContext = {
  projectId?: string;
  projectTitle: string;
  deadline?: string;
  stagesCreated: number;
  tasksCreated: number;
  sourceFileName?: string;
  importedAt: string;
  parsedProject?: {
    title?: string;
    description?: string;
    deadline?: string;
    phases?: Array<{
      name?: string;
      start_date?: string;
      end_date?: string;
      tasks?: Array<{
        name?: string;
        status?: string;
        start_date?: string;
        end_date?: string;
      }>;
    }>;
  };
  nextTaskCursor?: number;
};

export const AI_CONTEXT_STORAGE_KEY = "ai_project_context";
export const AI_CONTEXT_UPDATED_EVENT = "ai-context-updated";

function isBrowser() {
  return typeof window !== "undefined";
}

function buildScopedContextKey() {
  const userId = getCurrentUserId() || 'anonymous';
  return `${AI_CONTEXT_STORAGE_KEY}:${userId}`;
}

export function saveAIProjectContext(context: AIProjectContext) {
  if (!isBrowser()) return;
  localStorage.setItem(buildScopedContextKey(), JSON.stringify(context));
  window.dispatchEvent(new CustomEvent<AIProjectContext>(AI_CONTEXT_UPDATED_EVENT, { detail: context }));
}

export function loadAIProjectContext(): AIProjectContext | null {
  if (!isBrowser()) return null;
  const scopedKey = buildScopedContextKey();
  const raw = localStorage.getItem(scopedKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AIProjectContext;
  } catch {
    return null;
  }
}

export function clearAIProjectContext() {
  if (!isBrowser()) return;
  localStorage.removeItem(buildScopedContextKey());
  window.dispatchEvent(new CustomEvent(AI_CONTEXT_UPDATED_EVENT));
}
