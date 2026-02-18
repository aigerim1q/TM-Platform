'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Send, FileText, Phone, Video, MoreVertical, Sparkles, SquarePen, AlertTriangle, User, Plus, ArrowUp, ShieldCheck, ChevronRight } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AI_CONTEXT_UPDATED_EVENT, type AIProjectContext, loadAIProjectContext, saveAIProjectContext } from '@/lib/ai-context';

interface ProjectInfo {
    name: string;
    description: string;
    fileName: string;
    fileSize: string;
    href?: string;
}

interface Message {
    id: number | string;
    text: string;
    sender: 'user' | 'other';
    timestamp: string;
    senderName?: string;
    projectInfo?: ProjectInfo;
}

interface PersistedMessage {
    id: string;
    sender: 'user' | 'other';
    text: string;
    projectInfo?: ProjectInfo;
    createdAt: string;
}

interface AIChatContentProps {
    chatId: number;
    chatName: string;
    chatAvatar: string;
}

type UserProject = {
    id: string;
    title: string;
    deadline?: string;
    end_date?: string;
    status?: string;
};

type UserStage = {
    id: string;
    project_id?: string;
    title?: string;
};

type UserTask = {
    id: string;
    stage_id?: string;
    project_id?: string;
    title?: string;
    status?: string;
    start_date?: string;
    deadline?: string;
    projectTitle?: string;
    stageTitle?: string;
};

type WorkspaceProject = UserProject & {
    stages: UserStage[];
    tasks: UserTask[];
};

type WorkspaceContext = {
    projects: WorkspaceProject[];
    tasks: UserTask[];
    upcomingTasks: UserTask[];
    loadedAt: number;
};

function resolveProjectCardHref(href?: string) {
    const fallback = '/projects/new';
    if (!href) return fallback;

    const raw = href.trim();
    if (!raw) return fallback;

    if (/^\/project\/[0-9a-f-]+$/i.test(raw)) {
        return raw.replace(/^\/project\//i, '/project-overview/');
    }

    return raw;
}

export default function AIChatContent({ chatId, chatName, chatAvatar }: AIChatContentProps) {
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode');
    const chatMode: 'template' | 'ordinary' = mode === 'ordinary' ? 'ordinary' : 'template';

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [activeContext, setActiveContext] = useState<AIProjectContext | null>(null);
    const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null);

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
        let isMounted = true;

        (async () => {
            try {
                const { data: projectsData } = await api.get<UserProject[]>('/projects/');
                const projects = Array.isArray(projectsData) ? projectsData : [];

                const projectsWithDetails = await Promise.all(
                    projects.map(async (project) => {
                        try {
                            const { data: stagesData } = await api.get<UserStage[]>(`/projects/${project.id}/stages`);
                            const stages = Array.isArray(stagesData) ? stagesData : [];

                            const tasksPerStage = await Promise.all(
                                stages.map(async (stage) => {
                                    try {
                                        const { data: tasksData } = await api.get<UserTask[]>(`/stages/${stage.id}/tasks`);
                                        const tasks = Array.isArray(tasksData) ? tasksData : [];
                                        return tasks.map((task) => ({
                                            ...task,
                                            projectTitle: project.title,
                                            stageTitle: stage.title || 'Без этапа',
                                        }));
                                    } catch {
                                        return [] as UserTask[];
                                    }
                                })
                            );

                            return {
                                ...project,
                                stages,
                                tasks: tasksPerStage.flat(),
                            } as WorkspaceProject;
                        } catch {
                            return {
                                ...project,
                                stages: [],
                                tasks: [],
                            } as WorkspaceProject;
                        }
                    })
                );

                const allTasks = projectsWithDetails.flatMap((project) => project.tasks);
                const upcomingTasks = [...allTasks]
                    .filter((task) => task.deadline && !Number.isNaN(new Date(task.deadline).getTime()))
                    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())
                    .slice(0, 10);

                if (!isMounted) return;
                setWorkspaceContext({
                    projects: projectsWithDetails,
                    tasks: allTasks,
                    upcomingTasks,
                    loadedAt: Date.now(),
                });
            } catch {
                if (!isMounted) return;
                setWorkspaceContext({ projects: [], tasks: [], upcomingTasks: [], loadedAt: Date.now() });
            }
        })();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        (async () => {
            try {
                const { data } = await api.get<PersistedMessage[]>('/ai-chat/messages', {
                    params: { mode: chatMode },
                });

                if (!isMounted) return;

                if (Array.isArray(data) && data.length > 0) {
                    setMessages(
                        data.map((item) => ({
                            id: item.id,
                            text: item.text,
                            sender: item.sender,
                            timestamp: new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                            senderName: item.sender === 'other' ? 'AI-Ассистент' : undefined,
                            projectInfo: item.projectInfo,
                        }))
                    );
                    return;
                }
            } catch {
                // fallback to local greeting
            }

            if (!isMounted) return;

            setMessages([
                {
                    id: 0,
                    text: buildGreeting(activeContext),
                    sender: 'other',
                    timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                    senderName: 'AI-Ассистент',
                },
            ]);
        })();

        return () => {
            isMounted = false;
        };
    }, [chatMode]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const persistMessage = async (sender: 'user' | 'other', text: string, projectInfo?: ProjectInfo) => {
        try {
            await api.post('/ai-chat/messages', {
                mode: chatMode,
                sender,
                text,
                projectInfo: projectInfo ?? null,
            });
        } catch {
            // message is still shown in UI even if persistence request fails
        }
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const prompt = input.trim();
        if (!prompt) return;

        const userMessage: Message = {
            id: messages.length + 1,
            text: prompt,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        void persistMessage('user', prompt);

        // AI Bot auto-reply logic with context support
        setTimeout(() => {
            (async () => {
            let aiResponseText = "Я понял запрос. Уточните, что нужно: резюме контекста, риски, советы или план действий.";
            let projectInfo: ProjectInfo | undefined = undefined;

            const lowerInput = prompt.toLowerCase();

            if (lowerInput.includes('привет') || lowerInput.includes('hello')) {
                aiResponseText = buildHelloAnswer(activeContext, workspaceContext);
            } else {
                const createProjectCmd = (lowerInput.includes('создай') || lowerInput.includes('создать')) && lowerInput.includes('проект');
                const createTaskCmd = (lowerInput.includes('создай') || lowerInput.includes('создать')) && lowerInput.includes('задач');
                const asksContext = lowerInput.includes('контекст') || lowerInput.includes('что в файле') || lowerInput.includes('о чем') || lowerInput.includes('что загружено');
                const asksDeadlines = lowerInput.includes('дедлайн') || lowerInput.includes('срок') || lowerInput.includes('когда сдача') || lowerInput.includes('до какого числа');
                const asksRisks = lowerInput.includes('риск') || lowerInput.includes('проблем') || lowerInput.includes('узк');
                const asksAdvice = lowerInput.includes('совет') || lowerInput.includes('рекоменд') || lowerInput.includes('улучш') || lowerInput.includes('оптим');
                const asksPlan = lowerInput.includes('план') || lowerInput.includes('следующ') || lowerInput.includes('что делать');
                const asksTasksList =
                    lowerInput.includes('мои задачи') ||
                    lowerInput.includes('какие задачи') ||
                    lowerInput.includes('что по задачам') ||
                    lowerInput.includes('список задач') ||
                    lowerInput.includes('задачи у меня');
                const asksProjectsList =
                    lowerInput.includes('какие проекты') ||
                    lowerInput.includes('что по проектам') ||
                    lowerInput.includes('мои проекты') ||
                    lowerInput.includes('проекты у меня') ||
                    lowerInput.includes('список проектов');

                if (createProjectCmd) {
                    if (!activeContext) {
                        aiResponseText = 'Сначала загрузите контекст через «Добавить контекст», потом я создам проект автоматически.';
                    } else 
                    if (!activeContext.parsedProject) {
                        aiResponseText = 'Не найден распарсенный контекст. Загрузите файл через «Добавить контекст». '; 
                    } else {
                        try {
                            const { data } = await api.post<{
                                projectId: string;
                                project?: { title?: string; deadline?: string };
                                stagesCreated?: number;
                                tasksCreated?: number;
                            }>('/zhcp/create-project-from-context', {
                                parsedProject: activeContext.parsedProject,
                            });

                            if (data?.projectId) {
                                const updatedContext: AIProjectContext = {
                                    ...activeContext,
                                    projectId: data.projectId,
                                    projectTitle: data.project?.title || activeContext.projectTitle,
                                    deadline: data.project?.deadline || activeContext.deadline,
                                    stagesCreated: data.stagesCreated ?? activeContext.stagesCreated,
                                    tasksCreated: data.tasksCreated ?? activeContext.tasksCreated,
                                    nextTaskCursor: 0,
                                };
                                saveAIProjectContext(updatedContext);
                                setActiveContext(updatedContext);

                                aiResponseText = `Готово. Проект создан по контексту: ${updatedContext.projectTitle}.`;
                                projectInfo = {
                                    name: `Проект: ${updatedContext.projectTitle}`,
                                    description: `Этапов: ${updatedContext.stagesCreated}, задач: ${updatedContext.tasksCreated}`,
                                    fileName: updatedContext.sourceFileName || 'ЖЦП документ',
                                    fileSize: updatedContext.deadline ? `Дедлайн: ${formatDateRu(updatedContext.deadline)}` : 'Дедлайн не указан',
                                    href: `/project-overview/${updatedContext.projectId}`,
                                };
                            } else {
                                aiResponseText = 'Не удалось создать проект по контексту.';
                            }
                        } catch (error) {
                            aiResponseText = getApiErrorMessage(error, 'Ошибка при создании проекта из контекста');
                        }
                    }
                } else if (createTaskCmd) {
                    if (!activeContext) {
                        aiResponseText = 'Сначала загрузите контекст через «Добавить контекст», затем я смогу создать задачу по документу.';
                    } else 
                    if (!activeContext.projectId) {
                        aiResponseText = 'Сначала создайте проект по контексту командой: «создай проект по контексту». '; 
                    } else if (!activeContext.parsedProject) {
                        aiResponseText = 'Не найден распарсенный контекст. Загрузите файл через «Добавить контекст». '; 
                    } else {
                        try {
                            const { data } = await api.post<{
                                taskId: string;
                                taskTitle: string;
                                stageId: string;
                                stageTitle: string;
                                nextCursor: number;
                                projectId: string;
                            }>('/zhcp/create-task-from-context', {
                                projectId: activeContext.projectId,
                                parsedProject: activeContext.parsedProject,
                                cursor: activeContext.nextTaskCursor || 0,
                            });

                            const updatedContext: AIProjectContext = {
                                ...activeContext,
                                nextTaskCursor: data?.nextCursor ?? activeContext.nextTaskCursor,
                            };
                            saveAIProjectContext(updatedContext);
                            setActiveContext(updatedContext);

                            aiResponseText = `Задача создана: «${data.taskTitle}» в этапе «${data.stageTitle}».`;
                        } catch (error) {
                            aiResponseText = getApiErrorMessage(error, 'Ошибка при создании задачи из контекста');
                        }
                    }
                } else if (asksProjectsList) {
                    aiResponseText = buildProjectsListAnswer(workspaceContext?.projects || []);
                } else if (asksTasksList) {
                    aiResponseText = buildTasksListAnswer(workspaceContext);
                } else if (asksDeadlines) {
                    aiResponseText = buildDeadlineAnswer(activeContext, workspaceContext);
                } else if (asksContext) {
                    aiResponseText = activeContext
                        ? buildContextSummary(activeContext)
                        : buildWorkspaceSummary(workspaceContext);
                } else if (asksRisks) {
                    aiResponseText = activeContext
                        ? buildRiskNotes(activeContext)
                        : buildPortfolioRiskNotes(workspaceContext);
                } else if (asksAdvice || asksPlan) {
                    aiResponseText = activeContext
                        ? buildAdvice(activeContext)
                        : buildWorkspaceAdvice(workspaceContext);
                } else {
                    aiResponseText = activeContext
                        ? buildDocumentAnswer(activeContext, prompt)
                        : buildWorkspaceGenericAnswer(workspaceContext, prompt);
                }

            }

            const aiMessage: Message = {
                id: Date.now(),
                text: aiResponseText,
                sender: 'other',
                timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                senderName: 'AI-Ассистент',
                projectInfo
            };
            setMessages(prev => [...prev, aiMessage]);
            void persistMessage('other', aiResponseText, projectInfo);
            })();
        }, 500);
    };

    const suggestionCards = [
        {
            icon: <SquarePen size={20} className="text-blue-500" />,
            iconBg: 'bg-blue-50 dark:bg-blue-900/20',
            title: 'Спланировать проект',
            desc: 'Создадим структуру этапов и задач для нового объекта'
        },
        {
            icon: <AlertTriangle size={20} className="text-purple-500" />,
            iconBg: 'bg-purple-50 dark:bg-purple-900/20',
            title: 'Проанализировать риски',
            desc: 'Найду слабые места в текущем графике поставок'
        },
        {
            icon: <User size={20} className="text-pink-500" />,
            iconBg: 'bg-pink-50 dark:bg-pink-900/20',
            title: 'Распределить задачи',
            desc: 'Оптимально назначу исполнителей по компетенциям'
        }
    ];

    return (
        <div className="flex-1 flex flex-col bg-[#F9F9FB] dark:bg-background h-full transition-colors">
            {/* Messages Area / Welcome Screen */}
            <div className="flex-1 overflow-y-auto px-6 pt-10">
                {messages.length === 0 ? (
                    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-full text-center py-10">
                        {/* Central Icon */}
                        <div className="w-16 h-16 bg-linear-to-br from-[#A855F7] to-[#7C3AED] rounded-2xl flex items-center justify-center shadow-[0_8px_20px_rgba(139,92,246,0.3)] mb-8">
                            <Sparkles className="text-white" size={32} />
                        </div>

                        <h1 className="text-4xl font-bold text-[#111827] dark:text-white mb-4 transition-colors">
                            Чем я могу помочь вам сегодня?
                        </h1>
                        <p className="text-lg text-gray-500 dark:text-gray-400 mb-12 transition-colors">
                            Задайте вопрос или выберите одно из предложений ниже
                        </p>

                        {/* Suggestion Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
                            {suggestionCards.map((card, i) => (
                                <div
                                    key={i}
                                    className="bg-white dark:bg-card p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md dark:hover:bg-white/5 transition-all cursor-pointer text-left group"
                                    onClick={() => setInput(card.title)}
                                >
                                    <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                                        {card.icon}
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2 transition-colors">{card.title}</h3>
                                    <p className="text-sm text-gray-400 dark:text-gray-400 leading-relaxed transition-colors">{card.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-6 pb-10">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] ${message.sender === 'user'
                                        ? 'bg-[#8B5CF6] text-white rounded-2xl rounded-tr-none px-5 py-3 shadow-sm'
                                        : 'bg-white dark:bg-card text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-none px-5 py-3 border border-gray-100 dark:border-white/10 shadow-sm'
                                        }`}
                                >
                                    <p className="text-[15px] leading-relaxed">{message.text}</p>

                                    {message.projectInfo && (
                                        <Link href={resolveProjectCardHref(message.projectInfo.href)}>
                                            <div className="mt-4 p-4 border border-[#8B5CF6] rounded-xl bg-white dark:bg-black/20 shadow-sm hover:shadow-md transition-all group cursor-pointer">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 bg-[#F5F3FF] dark:bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                                                        <FileText className="text-[#8B5CF6]" size={22} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="font-bold text-[#111827] dark:text-white text-sm transition-colors">{message.projectInfo.name}</h4>
                                                            <ChevronRight size={18} className="text-[#8B5CF6]" />
                                                        </div>
                                                        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 leading-snug transition-colors">
                                                            {message.projectInfo.description}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-3 text-[12px] text-gray-400">
                                                            <FileText size={14} className="opacity-60" />
                                                            <span>{message.projectInfo.fileName}</span>
                                                            <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                                                            <span>{message.projectInfo.fileSize}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    )}

                                    <div className={`text-[10px] mt-1.5 font-medium ${message.sender === 'user' ? 'text-white/60 text-right' : 'text-gray-400 dark:text-gray-500'}`}>
                                        {message.timestamp}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Message Input Area */}
            <div className="px-6 pb-8 pt-4">
                <div className="max-w-4xl mx-auto relative">
                    <form
                        onSubmit={handleSendMessage}
                        className="relative flex items-center bg-white dark:bg-card rounded-3xl border border-[#E5E7EB] dark:border-white/10 shadow-[0_2px_15px_rgba(0,0,0,0.02)] ring-1 ring-purple-100/50 dark:ring-white/5 p-2 pl-4 transition-all focus-within:ring-purple-200 dark:focus-within:ring-white/20 focus-within:shadow-lg"
                    >
                        <button type="button" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <Plus size={20} />
                        </button>

                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Опишите задачу или задайте вопрос AI..."
                            className="flex-1 bg-transparent border-0 outline-none focus:ring-0 focus:outline-none text-[15px] text-gray-700 dark:text-white px-3 py-3 placeholder:text-gray-400 placeholder:font-medium"
                        />

                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="w-10 h-10 bg-[#4B4B4B] hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-200 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white rounded-full flex items-center justify-center transition-all shadow-sm shrink-0"
                        >
                            <ArrowUp className="w-5 h-5" />
                        </button>
                    </form>

                    {/* Footer Info */}
                    <div className="flex justify-between items-center mt-4 px-2 text-[11px] font-medium tracking-tight">
                        <div className="flex items-center gap-1.5 text-gray-400">
                            <div className="text-[#10B981]">
                                <ShieldCheck size={14} />
                            </div>
                            Ваши данные защищены
                        </div>
                        <div className="text-gray-400/80">
                            Нажмите Enter для отправки
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatDateRu(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('ru-RU');
}

function buildGreeting(ctx: AIProjectContext | null) {
    const defaultText = 'Я твой AI-помощник. Задавай вопросы по контексту или документу.';
    if (!ctx) return defaultText;
    return `Контекст загружен: ${ctx.projectTitle}. Задайте вопрос: «что в контексте?», «какие риски?» или «дай советы по проекту».`;
}

function buildHelloAnswer(ctx: AIProjectContext | null, workspace: WorkspaceContext | null) {
    if (ctx) {
        return `Контекст активен: ${ctx.projectTitle}. Также вижу ваши проекты и задачи. Спросите: «мои проекты», «мои задачи», «ближайшие дедлайны», «риски».`;
    }

    if (workspace && workspace.projects.length > 0) {
        return `Привет! Я вижу ${workspace.projects.length} проектов и ${workspace.tasks.length} задач в вашем рабочем пространстве. Можете спрашивать в свободной форме про дедлайны, риски и план.`;
    }

    return 'Привет! Я готов помогать по вашим проектам и задачам. Если нужно, загрузите контекст через «Добавить контекст». ';
}

function buildContextSummary(ctx: AIProjectContext) {
    const deadlineText = ctx.deadline ? formatDateRu(ctx.deadline) : 'не указан';
    return `По загруженному контексту:\n• Проект: ${ctx.projectTitle}\n• Этапов создано: ${ctx.stagesCreated}\n• Задач создано: ${ctx.tasksCreated}\n• Дедлайн: ${deadlineText}`;
}

function buildRiskNotes(ctx: AIProjectContext) {
    const risks: string[] = [];

    if (ctx.stagesCreated <= 1) {
        risks.push('Низкая декомпозиция этапов — стоит разбить проект минимум на 3–5 этапов.');
    }

    if (ctx.tasksCreated < ctx.stagesCreated * 2) {
        risks.push('Слишком мало задач на этап — есть риск скрытых работ и срыва сроков.');
    }

    if (ctx.deadline) {
        const daysLeft = Math.ceil((new Date(ctx.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 14) {
            risks.push('Короткий горизонт до дедлайна — нужен ежедневный контроль критического пути.');
        }
    }

    if (risks.length === 0) {
        risks.push('Критичных рисков по структуре не видно, но рекомендую еженедельно обновлять статусы задач.');
    }

    return `Риски по текущему контексту:\n${risks.map((r) => `• ${r}`).join('\n')}`;
}

function buildAdvice(ctx: AIProjectContext) {
    const tips: string[] = [
        'Зафиксируйте 3–5 ключевых вех и привяжите к ним ответственных.',
        'Выделите критические задачи и проверяйте их статус ежедневно.',
        'Добавьте буфер 10–15% времени на интеграцию и исправления.',
    ];

    if (ctx.tasksCreated > 0 && ctx.stagesCreated > 0) {
        const ratio = ctx.tasksCreated / ctx.stagesCreated;
        if (ratio < 3) {
            tips.push('Уточните детализацию: в среднем лучше 3+ задач на каждый этап.');
        }
    }

    if (ctx.deadline) {
        tips.push(`Поставьте контрольную точку за 7 дней до дедлайна (${formatDateRu(ctx.deadline)}).`);
    }

    return `Практические советы для проекта «${ctx.projectTitle}»:\n${tips.map((t) => `• ${t}`).join('\n')}`;
}

function buildDeadlineAnswer(ctx: AIProjectContext | null, workspace: WorkspaceContext | null) {
    if (workspace && workspace.upcomingTasks.length > 0) {
        const nearest = workspace.upcomingTasks.slice(0, 5).map((task) => {
            const projectTitle = task.projectTitle || 'Проект';
            const taskTitle = task.title || 'Без названия';
            const deadline = task.deadline ? formatDateRu(task.deadline) : 'без даты';
            return `• ${taskTitle} — ${deadline} (${projectTitle})`;
        });

        return `Ближайшие дедлайны по вашим задачам:\n${nearest.join('\n')}`;
    }

    if (!ctx) {
        return 'Пока не вижу дедлайнов. Проверьте доступ к проектам или загрузите контекст документа.';
    }

    const projectDeadline = ctx.deadline ? formatDateRu(ctx.deadline) : 'не указан';
    const nearest = getNearestTaskDeadlines(ctx, 3);
    if (nearest.length === 0) {
        return `По документу:\n• Дедлайн проекта: ${projectDeadline}\n• По задачам в контексте даты дедлайнов не найдены.`;
    }

    return `По дедлайнам:\n• Дедлайн проекта: ${projectDeadline}\n• Ближайшие сроки задач:\n${nearest.map((x) => `  - ${x}`).join('\n')}`;
}

function buildProjectsListAnswer(projects: Array<UserProject | WorkspaceProject>) {
    if (!projects.length) {
        return 'Сейчас у вас нет проектов или к ним нет доступа.';
    }

    const top = projects.slice(0, 7);
    const lines = top.map((p) => {
        const deadline = p.deadline || p.end_date;
        const deadlineText = deadline ? formatDateRu(deadline) : 'без дедлайна';
        const status = p.status || 'unknown';
        return `• ${p.title} — ${deadlineText} (${status})`;
    });

    const suffix = projects.length > top.length ? `\nИ ещё ${projects.length - top.length} проект(ов).` : '';
    return `Ваши текущие проекты:\n${lines.join('\n')}${suffix}`;
}

function buildTasksListAnswer(workspace: WorkspaceContext | null) {
    if (!workspace || workspace.tasks.length === 0) {
        return 'Пока не вижу задач в доступных проектах.';
    }

    const preview = workspace.tasks.slice(0, 8).map((task) => {
        const title = task.title || 'Без названия';
        const project = task.projectTitle || 'Проект не указан';
        const deadline = task.deadline ? formatDateRu(task.deadline) : 'без дедлайна';
        const status = task.status || 'todo';
        return `• ${title} — ${deadline} (${project}, ${status})`;
    });

    const suffix = workspace.tasks.length > preview.length
        ? `\nИ ещё ${workspace.tasks.length - preview.length} задач(и).`
        : '';
    return `Ваши задачи:\n${preview.join('\n')}${suffix}`;
}

function buildWorkspaceSummary(workspace: WorkspaceContext | null) {
    if (!workspace || workspace.projects.length === 0) {
        return 'Контекст по проектам пока пуст. Проверьте доступы или загрузите файл контекста.';
    }

    const upcoming = workspace.upcomingTasks.slice(0, 3).map((task) => {
        const title = task.title || 'Без названия';
        const deadline = task.deadline ? formatDateRu(task.deadline) : 'без даты';
        return `• ${title} — ${deadline}`;
    });

    return `Сводка по рабочему пространству:\n• Проектов: ${workspace.projects.length}\n• Задач: ${workspace.tasks.length}${upcoming.length ? `\n• Ближайшие дедлайны:\n${upcoming.join('\n')}` : ''}`;
}

function buildPortfolioRiskNotes(workspace: WorkspaceContext | null) {
    if (!workspace || workspace.projects.length === 0) {
        return 'Недостаточно данных для оценки рисков по портфелю проектов.';
    }

    const risks: string[] = [];
    const overdueTasks = workspace.tasks.filter((task) => {
        if (!task.deadline) return false;
        const deadline = new Date(task.deadline);
        return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now() && task.status !== 'done';
    });

    if (overdueTasks.length > 0) {
        risks.push(`Есть просроченные задачи: ${overdueTasks.length}. Нужен фокус на закрытие просрочки.`);
    }

    const noDeadlineTasks = workspace.tasks.filter((task) => !task.deadline);
    if (noDeadlineTasks.length > 0) {
        risks.push(`Без дедлайна: ${noDeadlineTasks.length} задач. Рекомендую поставить даты.`);
    }

    if (risks.length === 0) {
        risks.push('Критичных рисков не видно. Продолжайте еженедельный контроль сроков и статусов.');
    }

    return `Риски по вашим проектам:\n${risks.map((r) => `• ${r}`).join('\n')}`;
}

function buildWorkspaceAdvice(workspace: WorkspaceContext | null) {
    if (!workspace || workspace.projects.length === 0) {
        return 'Совет: сначала загрузите или создайте проекты, чтобы я мог дать более точные рекомендации.';
    }

    const tips: string[] = [
        'Проведите ревизию всех задач без дедлайна и назначьте даты.',
        'Выделите 5 ближайших критических задач и контролируйте их ежедневно.',
        'По каждому проекту зафиксируйте ответственного за результат недели.',
    ];

    if (workspace.upcomingTasks.length > 0) {
        tips.push('Перепроверьте загрузку команды по ближайшим дедлайнам на 7–14 дней.');
    }

    return `Рекомендации по вашим проектам:\n${tips.map((t) => `• ${t}`).join('\n')}`;
}

function buildWorkspaceGenericAnswer(workspace: WorkspaceContext | null, question: string) {
    if (!workspace) {
        return 'Я получил запрос. Могу отвечать по проектам, задачам, дедлайнам и рискам. Спросите: «мои проекты» или «ближайшие дедлайны». ';
    }

    const q = question.toLowerCase();
    if (q.includes('просроч')) {
        const overdue = workspace.tasks.filter((task) => {
            if (!task.deadline) return false;
            const deadline = new Date(task.deadline);
            return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now() && task.status !== 'done';
        });
        return overdue.length
            ? `У вас ${overdue.length} просроченных задач. Хотите, выведу топ-5 по ближайшей дате?`
            : 'Просроченных задач не найдено.';
    }

    return `Я понял запрос. У меня есть данные по ${workspace.projects.length} проектам и ${workspace.tasks.length} задачам. Уточните, что нужно: список проектов, задачи, дедлайны, риски или план действий.`;
}

function buildDocumentAnswer(ctx: AIProjectContext, question: string) {
    const q = question.toLowerCase();
    const phaseNames = (ctx.parsedProject?.phases || [])
        .map((p) => p?.name?.trim())
        .filter((x): x is string => Boolean(x));

    if (q.includes('этап')) {
        if (!phaseNames.length) {
            return `По документу не удалось выделить названия этапов. Но проект распознан: ${ctx.projectTitle}.`;
        }
        return `По документу этапы проекта:\n${phaseNames.slice(0, 6).map((x) => `• ${x}`).join('\n')}`;
    }

    if (q.includes('задач')) {
        return `В контексте документа по проекту «${ctx.projectTitle}» распознано примерно ${ctx.tasksCreated} задач.`;
    }

    return `${buildContextSummary(ctx)}\n\nМогу ответить точнее, например: «какие дедлайны», «риски», «советы по ускорению», «какие этапы».`;
}

function getNearestTaskDeadlines(ctx: AIProjectContext, limit: number) {
    const phases = ctx.parsedProject?.phases || [];
    const rows: Array<{ title: string; deadline: Date }> = [];

    for (const phase of phases) {
        for (const task of phase.tasks || []) {
            const raw = task.end_date || task.start_date;
            if (!raw) continue;

            const parsed = new Date(raw);
            if (Number.isNaN(parsed.getTime())) continue;

            const title = task.name?.trim() || 'Без названия';
            rows.push({ title, deadline: parsed });
        }
    }

    rows.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    return rows.slice(0, limit).map((x) => `${x.title} — ${x.deadline.toLocaleDateString('ru-RU')}`);
}
