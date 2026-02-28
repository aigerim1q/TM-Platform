'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ArrowUp, Sparkles, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { clearAiChatHistory } from '@/lib/ai-chat';
import { AI_CONTEXT_UPDATED_EVENT, type AIProjectContext, loadAIProjectContext } from '@/lib/ai-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type PersistedMessage = {
  id: string;
  sender: 'user' | 'other';
  text: string;
  createdAt: string;
};

type ChatMessage = {
  id: string | number;
  sender: 'user' | 'other';
  text: string;
  timestamp: string;
};

type UserProject = {
  id: string;
  title: string;
  deadline?: string;
  end_date?: string;
  status?: string;
};

type UserStage = {
  id: string;
  title?: string;
};

type UserTask = {
  id: string;
  title?: string;
  status?: string;
  deadline?: string;
  projectTitle?: string;
};

type WorkspaceContext = {
  projects: UserProject[];
  tasks: UserTask[];
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function isClearChatCommand(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === '/clear' || normalized === 'очистить чат';
}

function formatTime(dateLike: string | number | Date) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateRu(value?: string) {
  if (!value) return 'без дедлайна';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('ru-RU');
}

function buildProjectsAnswer(projects: UserProject[]) {
  if (!projects.length) return 'Сейчас у вас нет доступных проектов.';
  return `Ваши проекты:\n${projects
    .slice(0, 7)
    .map((p) => `• ${p.title} — ${formatDateRu(p.deadline || p.end_date)} (${p.status || 'unknown'})`)
    .join('\n')}`;
}

function buildTasksAnswer(tasks: UserTask[]) {
  if (!tasks.length) return 'Сейчас не вижу задач в ваших проектах.';
  return `Ваши задачи:\n${tasks
    .slice(0, 8)
    .map((t) => `• ${t.title || 'Без названия'} — ${formatDateRu(t.deadline)} (${t.projectTitle || 'Проект'}, ${t.status || 'todo'})`)
    .join('\n')}`;
}

function buildDeadlinesAnswer(tasks: UserTask[]) {
  const upcoming = [...tasks]
    .filter((t) => t.deadline && !Number.isNaN(new Date(t.deadline).getTime()))
    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())
    .slice(0, 5);

  if (!upcoming.length) return 'По задачам с дедлайнами пока данных нет.';

  return `Ближайшие дедлайны:\n${upcoming
    .map((t) => `• ${t.title || 'Без названия'} — ${formatDateRu(t.deadline)} (${t.projectTitle || 'Проект'})`)
    .join('\n')}`;
}

function buildRiskAnswer(tasks: UserTask[]) {
  if (!tasks.length) return 'Для оценки рисков пока мало данных по задачам.';

  const overdue = tasks.filter((t) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now() && t.status !== 'done';
  });

  const noDeadline = tasks.filter((t) => !t.deadline);
  const lines: string[] = [];

  if (overdue.length) lines.push(`• Просроченные задачи: ${overdue.length}`);
  if (noDeadline.length) lines.push(`• Задачи без дедлайна: ${noDeadline.length}`);
  if (!lines.length) lines.push('• Критичных рисков по срокам не видно.');

  return `Риски по вашим задачам:\n${lines.join('\n')}`;
}

function buildAdviceAnswer(projects: UserProject[], tasks: UserTask[]) {
  const tips: string[] = [
    'Зафиксируйте топ-5 критичных задач на ближайшие 7 дней.',
    'Назначьте ответственных по задачам без дедлайна.',
    'Проверяйте просроченные задачи ежедневно до закрытия.',
  ];

  const noDeadline = tasks.filter((t) => !t.deadline).length;
  if (noDeadline > 0) {
    tips.push(`У вас ${noDeadline} задач без дедлайна — это главный источник срыва сроков.`);
  }

  if (projects.length > 0) {
    tips.push('Сделайте еженедельный статус-обзор по каждому проекту (15–20 минут).');
  }

  return `План/советы по вашим проектам:\n${tips.map((t) => `• ${t}`).join('\n')}`;
}

function buildContextAnswer(projects: UserProject[], tasks: UserTask[]) {
  if (!projects.length) {
    return 'Контекст пуст: не вижу доступных проектов. Проверьте доступы.';
  }

  const withDeadline = tasks.filter((t) => !!t.deadline).length;
  return `Текущий контекст пользователя:\n• Проектов: ${projects.length}\n• Задач: ${tasks.length}\n• Задач с дедлайном: ${withDeadline}\n• Задач без дедлайна: ${tasks.length - withDeadline}`;
}

function extractContextTasks(context: AIProjectContext) {
  return (context.parsedProject?.phases || [])
    .flatMap((phase) => (phase.tasks || []).map((task) => ({
      title: String(task?.name || '').trim() || 'Без названия',
      deadline: String(task?.end_date || task?.start_date || '').trim() || undefined,
      status: String(task?.status || '').trim() || 'todo',
      projectTitle: context.projectTitle,
    })));
}

function buildContextTasksAnswer(context: AIProjectContext) {
  const tasks = extractContextTasks(context);
  if (!tasks.length) return `По активному контексту «${context.projectTitle}» задачи не найдены.`;
  return `Задачи активного контекста:\n${tasks
    .slice(0, 8)
    .map((t) => `• ${t.title} — ${formatDateRu(t.deadline)} (${t.projectTitle}, ${t.status})`)
    .join('\n')}`;
}

function buildContextDeadlinesAnswer(context: AIProjectContext) {
  const tasks = extractContextTasks(context);
  const upcoming = tasks
    .filter((t) => t.deadline && !Number.isNaN(new Date(t.deadline).getTime()))
    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())
    .slice(0, 5);

  if (!upcoming.length) {
    const projectDeadline = context.deadline ? formatDateRu(context.deadline) : 'без дедлайна';
    return `По активному контексту:\n• Дедлайн проекта: ${projectDeadline}\n• Даты задач не найдены.`;
  }

  return `Ближайшие дедлайны активного контекста:\n${upcoming
    .map((t) => `• ${t.title} — ${formatDateRu(t.deadline)} (${context.projectTitle})`)
    .join('\n')}`;
}

function buildContextRiskAnswer(context: AIProjectContext) {
  const tasks = extractContextTasks(context);
  if (!tasks.length) return 'Для оценки рисков по активному контексту пока мало данных.';
  const overdue = tasks.filter((t) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now() && t.status !== 'done';
  });
  if (overdue.length > 0) return `Риски по активному контексту:\n• Просроченные задачи: ${overdue.length}`;
  return 'Риски по активному контексту: критичных просрочек не видно.';
}

function answerByPrompt(prompt: string, ctx: WorkspaceContext | null, activeContext: AIProjectContext | null) {
  const q = prompt.toLowerCase();
  if (activeContext) {
    if (q.includes('привет') || q.includes('hello')) {
      return `Контекст активен: ${activeContext.projectTitle}. Отвечаю только по этому контексту.`;
    }
    if (q.includes('проект')) return `Активный проект: ${activeContext.projectTitle}.`;
    if (q.includes('задач')) return buildContextTasksAnswer(activeContext);
    if (q.includes('дедлайн') || q.includes('срок')) return buildContextDeadlinesAnswer(activeContext);
    if (q.includes('риск') || q.includes('проблем') || q.includes('просроч')) return buildContextRiskAnswer(activeContext);
    if (q.includes('контекст') || q.includes('сводка') || q.includes('что у меня')) {
      return `Текущий контекст: ${activeContext.projectTitle}. Этапов: ${activeContext.stagesCreated}, задач: ${activeContext.tasksCreated}.`;
    }
    return `Работаю только по активному контексту «${activeContext.projectTitle}». Уточните: задачи, дедлайны или риски.`;
  }

  const projects = ctx?.projects || [];
  const tasks = ctx?.tasks || [];

  if (q.includes('привет') || q.includes('hello')) {
    return `Привет! Я вижу ${projects.length} проектов и ${tasks.length} задач. Спросите: «мои проекты», «мои задачи», «дедлайны», «риски».`;
  }
  if (q.includes('проект')) return buildProjectsAnswer(projects);
  if (q.includes('задач')) return buildTasksAnswer(tasks);
  if (q.includes('дедлайн') || q.includes('срок')) return buildDeadlinesAnswer(tasks);
  if (q.includes('риск') || q.includes('проблем') || q.includes('просроч')) return buildRiskAnswer(tasks);
  if (q.includes('совет') || q.includes('рекоменд') || q.includes('план') || q.includes('что делать')) {
    return buildAdviceAnswer(projects, tasks);
  }
  if (q.includes('контекст') || q.includes('сводка') || q.includes('что у меня')) {
    return buildContextAnswer(projects, tasks);
  }

  return `Я понял запрос. У меня есть данные по ${projects.length} проектам и ${tasks.length} задачам. Уточните, что вывести: проекты, задачи, дедлайны или риски.`;
}

export default function AIChatModal({ open, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [ctx, setCtx] = useState<WorkspaceContext | null>(null);
  const [activeContext, setActiveContext] = useState<AIProjectContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const resolvedMode = useMemo(() => {
    if (!activeContext) {
      return 'ordinary';
    }
    const raw = `${activeContext.sourceFileName || ''}|${activeContext.importedAt || ''}|${activeContext.projectTitle || ''}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i += 1) {
      hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
    }
    return `template:${hash.toString(16)}`;
  }, [activeContext]);

  const initialGreeting = useMemo<ChatMessage>(() => ({
    id: 'greeting',
    sender: 'other',
    text: activeContext
      ? `Контекст активен: ${activeContext.projectTitle}. Отвечаю только по выбранному контексту.`
      : 'Привет! Это мини-чат AI. Я веду историю диалога и отвечаю по вашим проектам/задачам: «мои проекты», «мои задачи», «ближайшие дедлайны», «риски», «советы/план».',
    timestamp: formatTime(new Date()),
  }), [activeContext]);

  useEffect(() => {
    setActiveContext(loadAIProjectContext());

    const handleContextUpdated = () => {
      setActiveContext(loadAIProjectContext());
    };

    window.addEventListener(AI_CONTEXT_UPDATED_EVENT, handleContextUpdated as EventListener);
    return () => {
      window.removeEventListener(AI_CONTEXT_UPDATED_EVENT, handleContextUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    (async () => {
      try {
        const { data } = await api.get<PersistedMessage[]>('/ai-chat/messages', { params: { mode: resolvedMode } });
        if (!mounted) return;

        if (Array.isArray(data) && data.length > 0) {
          setMessages(data.map((m) => ({ id: m.id, sender: m.sender, text: m.text, timestamp: formatTime(m.createdAt) })));
        } else {
          setMessages([initialGreeting]);
        }
      } catch {
        if (mounted) setMessages([initialGreeting]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [initialGreeting, open, resolvedMode]);

  useEffect(() => {
    if (!open) return;
    if (activeContext) {
      setCtx(null);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const { data: projectsData } = await api.get<UserProject[]>('/projects/');
        const projects = Array.isArray(projectsData) ? projectsData : [];

        const tasksPerProject = await Promise.all(
          projects.map(async (project) => {
            try {
              const { data: stagesData } = await api.get<UserStage[]>(`/projects/${project.id}/stages`);
              const stages = Array.isArray(stagesData) ? stagesData : [];
              const tasksPerStage = await Promise.all(
                stages.map(async (stage) => {
                  try {
                    const { data: tasksData } = await api.get<UserTask[]>(`/stages/${stage.id}/tasks`);
                    const tasks = Array.isArray(tasksData) ? tasksData : [];
                    return tasks.map((task) => ({ ...task, projectTitle: project.title }));
                  } catch {
                    return [] as UserTask[];
                  }
                })
              );

              return tasksPerStage.flat();
            } catch {
              return [] as UserTask[];
            }
          })
        );

        if (!mounted) return;
        setCtx({ projects, tasks: tasksPerProject.flat() });
      } catch {
        if (mounted) setCtx({ projects: [], tasks: [] });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [activeContext, open]);

  const persistMessage = async (sender: 'user' | 'other', text: string) => {
    try {
      await api.post('/ai-chat/messages', { mode: resolvedMode, sender, text, projectInfo: null });
    } catch {
      // ignore persist errors in mini chat
    }
  };

  const clearCurrentChat = async () => {
    if (isClearing || loading) {
      return false;
    }

    setIsClearing(true);
    setClearError(null);

    try {
      await clearAiChatHistory(resolvedMode);
      setMessages([initialGreeting]);
      setIsClearConfirmOpen(false);
      return true;
    } catch (error) {
      setClearError(getApiErrorMessage(error, 'Не удалось очистить чат'));
      return false;
    } finally {
      setIsClearing(false);
    }
  };

  const requestClearChat = () => {
    if (isClearing || loading) {
      return;
    }
    setIsClearConfirmOpen(true);
  };

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || loading || isClearing) return;

    if (isClearChatCommand(prompt)) {
      setInput('');
      requestClearChat();
      return;
    }

    setClearError(null);

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: formatTime(new Date()),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    void persistMessage('user', prompt);

    await new Promise((resolve) => setTimeout(resolve, 850));
    const answer = answerByPrompt(prompt, ctx, activeContext);

    const aiMessage: ChatMessage = {
      id: `a-${Date.now()}`,
      sender: 'other',
      text: answer,
      timestamp: formatTime(new Date()),
    };

    setMessages((prev) => [...prev, aiMessage]);
    void persistMessage('other', answer);
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140]" onClick={onClose}>
      <div
        className="absolute bottom-28 right-6 w-[340px] max-w-[calc(100vw-24px)] h-[500px] bg-[#031f3d] dark:bg-[#031f3d] rounded-[28px] shadow-[0_18px_48px_rgba(0,0,0,0.35)] border border-[#0e3a6b] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-linear-to-r from-[#0a2e55] to-[#083763] text-white">
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            <span className="text-sm font-semibold">AI чат-помощник</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                requestClearChat();
              }}
              title="Очистить чат"
              aria-label="Очистить чат"
              disabled={isClearing || loading}
              className="p-1.5 rounded-full hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} />
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/15">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#04284d]">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl ${message.sender === 'user' ? 'bg-[#2d9cfa] text-white rounded-br-sm' : 'bg-[#15395f] text-white rounded-bl-sm border border-white/10'}`}>
                <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{message.text}</p>
                <p className={`text-[10px] mt-1 ${message.sender === 'user' ? 'text-white/70 text-right' : 'text-white/60'}`}>{message.timestamp}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[70%] px-3 py-2 rounded-2xl rounded-bl-sm bg-[#15395f] border border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-white/70">ИИ печатает</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:240ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div className="p-3 border-t border-white/10 bg-[#031f3d]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Спросите про проекты и дедлайны..."
              disabled={isClearing}
              className="flex-1 h-10 rounded-xl border border-white/15 bg-[#13385e] px-3 text-sm outline-none focus:ring-2 focus:ring-sky-300 text-white placeholder:text-white/60"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || isClearing}
              className="h-10 w-10 rounded-xl bg-[#2d9cfa] text-white flex items-center justify-center disabled:opacity-50"
            >
              <ArrowUp size={16} />
            </button>
          </form>
          {clearError && (
            <p className="mt-2 text-xs text-red-300">
              {clearError}
            </p>
          )}
        </div>
      </div>

      <AlertDialog
        open={isClearConfirmOpen}
        onOpenChange={(open) => {
          if (isClearing) {
            return;
          }
          setIsClearConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Очистить чат?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет удалена история только текущего режима чата.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
              onClick={() => {
                void clearCurrentChat();
              }}
              disabled={isClearing}
            >
              {isClearing ? 'Очистка...' : 'Очистить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
