'use client';

import Header from '@/components/header';
import { ArrowLeft, Zap, CheckCircle2, RotateCcw, FileText, Calendar, Check, Download, Edit2, User, ChevronRight, MoreVertical, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function ShyraqAnalysisPage() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [projectData, setProjectData] = useState({
        deadline: "15 сентября 2025",
        finModel: "Смета (Fixed Price)",
        stages: [
            { id: 1, title: 'Подготовительный этап и мобилизация ресурсов', duration: 'Срок: 14 дней' },
            { id: 2, title: 'Разработка и утверждение проектно-сметной документации', duration: 'Срок: 45 дней' },
            { id: 3, title: 'Закупка материалов и оборудования', duration: 'Срок: 30 дней' },
            { id: 4, title: 'Строительно-монтажные работы (СМР)', duration: 'Срок: 180 дней' },
            { id: 5, title: 'Пусконаладочные работы и тестирование систем', duration: 'Срок: 21 дней' },
            { id: 6, title: 'Ввод в эксплуатацию и передача заказчику', duration: 'Срок: 10 дней' },
        ]
    });

    // Load from localStorage on mount
    useEffect(() => {
        const savedData = localStorage.getItem('shyraq_project_data');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            // Transform duration back to display format
            const transformedStages = parsed.stages.map((s: any) => ({
                id: s.id,
                title: s.title,
                duration: `Срок: ${s.duration} дней`
            }));
            setProjectData({
                deadline: parsed.deadline,
                finModel: parsed.finModel,
                stages: transformedStages
            });
        }
        setIsLoaded(true);
    }, []);

    if (!isLoaded) return null;

    const projectStages = projectData.stages;

    const personnel = [
        { name: 'Омар Ахмет', role: 'РУКОВОДИТЕЛЬ ПРОЕКТА', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
        { name: 'Расул Даулетов', role: 'ТЕХНИЧЕСКИЙ ДИРЕКТОР', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=100&h=100&fit=crop' },
        { name: 'Айдын Рахимбаев', role: 'ГЛАВНЫЙ ИНЖЕНЕР', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
    ];

    return (
        <div className="min-h-screen bg-[#FDFDFE] dark:bg-background">
            <Header />

            <main className="pt-24 pb-16 px-6 max-w-7xl mx-auto">
                {/* Back Button and Subheader */}
                <div className="flex flex-col gap-8 mb-10">
                    <div>
                        <Link href="/chat">
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-[#D1C4AE]/90 dark:bg-[#4a4225] hover:bg-[#D1C4AE] dark:hover:bg-[#5c5230] text-[#2D2D2D] dark:text-amber-50 font-medium rounded-full transition-all text-sm shadow-sm active:scale-95">
                                <ArrowLeft size={16} strokeWidth={2.5} />
                                <span>Назад</span>
                            </button>
                        </Link>
                    </div>

                    <div className="flex items-start gap-8">
                        <div className="w-48 h-32 rounded-2xl overflow-hidden shadow-lg shrink-0">
                            <img
                                src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"
                                alt="Shyraq Building"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1 pt-2">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-[#EEF2FF] dark:bg-[#EEF2FF]/10 text-[#6366F1] dark:text-[#818cf8] rounded-full text-[11px] font-bold tracking-tight uppercase">
                                    <Zap size={12} fill="currentColor" strokeWidth={0} />
                                    <span>AI Обработка завершена</span>
                                </div>
                            </div>
                            <h1 className="text-[32px] font-extrabold text-[#111827] dark:text-white mb-2 tracking-tight">Проект: Shyraq</h1>
                            <p className="text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed text-[15px]">
                                Искусственный интеллект проанализировал ваш документ и сформировал структуру жизненного цикла проекта. Проверьте данные ниже.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
                    {/* Main Content Area */}
                    <div className="space-y-8">
                        {/* AI Processed Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-[32px] border-[1.5px] border-[#8B5CF6] dark:border-[#7c3aed] p-8 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-[#F5F3FF] dark:bg-[#F5F3FF]/10 rounded-[22px] flex items-center justify-center shrink-0">
                                        <div className="w-8 h-8 bg-[#8B5CF6] rounded-full flex items-center justify-center text-white">
                                            <Check size={20} strokeWidth={3} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-[#111827] dark:text-white mb-1">
                                        AI успешно обработал ваш документ
                                    </h2>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                                        <FileText size={16} className="text-[#EF4444]" fill="#EF4444" fillOpacity={0.1} />
                                        <span>Техническое_задание_Shyraq.pdf</span>
                                        <span className="text-gray-300 dark:text-gray-600">•</span>
                                        <span>2.4 MB</span>
                                    </div>
                                </div>
                            </div>
                            <button className="flex items-center gap-2 px-6 py-3 bg-[#F3F4F6] dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-2xl transition-all hover:bg-gray-200 dark:hover:bg-gray-600 text-sm">
                                <RotateCcw size={18} />
                                <span>Заменить файл</span>
                            </button>
                        </div>
                    </div>

                    {/* Parameters and Stages Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 p-10 shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-none">
                        {/* Document Parameters */}
                        <div className="mb-12">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#F5F3FF] dark:bg-[#F5F3FF]/10 rounded-lg">
                                        <FileText size={20} className="text-[#8B5CF6]" />
                                    </div>
                                    <h3 className="text-lg font-bold text-[#111827] dark:text-white">Параметры из документа</h3>
                                </div>
                                <span className="px-3 py-1 bg-[#EEF2FF] dark:bg-[#EEF2FF]/10 text-[#6366F1] dark:text-[#818cf8] rounded-full text-[10px] font-black tracking-widest uppercase">
                                    Автозаполнение
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Deadline box */}
                                <div className="p-1">
                                    <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block">
                                        Срок завершения (Дедлайн)
                                    </span>
                                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[24px] p-5 flex items-center gap-4 hover:shadow-sm transition-shadow cursor-default">
                                        <div className="w-12 h-12 bg-[#F9FAFB] dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center overflow-hidden shrink-0">
                                            <Calendar size={20} className="text-gray-400 dark:text-gray-500" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#111827] dark:text-white text-lg">{projectData.deadline}</div>
                                            <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">Извлечено из раздела 4.2 "Сроки"</div>
                                        </div>
                                    </div>
                                </div>
                                {/* Financial model box */}
                                <div className="p-1">
                                    <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block">
                                        Финансовая модель
                                    </span>
                                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[24px] p-5 flex items-center gap-4 hover:shadow-sm transition-shadow cursor-default">
                                        <div className="w-12 h-12 bg-[#F9FAFB] dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-center shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center shadow-sm shadow-yellow-200/50 dark:shadow-none">
                                                <Lightbulb size={18} className="text-yellow-500" fill="#EAB308" fillOpacity={0.1} />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#111827] dark:text-white text-lg">{projectData.finModel}</div>
                                            <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">Определено по ТЗ проекта</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Project Stages (ЖЦП) */}
                        <div>
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest uppercase mb-1">ЭТАПЫ ПРОЕКТА (ЖЦП)</h3>
                                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">Найдено этапов: {projectStages.length}</span>
                            </div>

                            <div className="space-y-4">
                                {projectStages.map((stage, index) => (
                                    <div key={stage.id} className="group bg-[#F9FAFB] dark:bg-gray-900 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md border border-transparent hover:border-gray-100 dark:hover:border-gray-600 rounded-[22px] p-6 transition-all flex items-center justify-between cursor-pointer">
                                        <div className="flex items-center gap-6">
                                            <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm text-gray-400 font-bold group-hover:text-[#6366F1] transition-colors">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold text-[#111827] dark:text-gray-100 text-[15px] group-hover:text-[#6366F1] transition-colors">
                                                    {stage.title}
                                                </div>
                                                <div className="text-[12px] text-gray-400 font-medium mt-0.5">
                                                    {stage.duration}
                                                </div>
                                            </div>
                                        </div>
                                        <button className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                            <Edit2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-4 mt-12 pt-8 border-t border-gray-100 dark:border-gray-700">
                            <button className="flex-1 min-w-[200px] flex items-center justify-center gap-3 px-8 py-4.5 bg-[#D1C4AE] hover:bg-[#C1B299] text-white font-bold rounded-[22px] shadow-lg shadow-[#D1C4AE]/20 transition-all hover:-translate-y-1 active:scale-95">
                                <span className="text-lg text-white/95">Подтвердить и продолжить</span>
                                <CheckCircle2 size={24} fill="white" className="text-[#D1C4AE]" strokeWidth={1} />
                            </button>
                            <Link href="/lifecycle/shyraq/edit">
                                <button className="px-10 py-4.5 bg-white dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-200 font-bold rounded-[22px] transition-all hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-200 dark:hover:border-gray-500 text-lg">
                                    Редактировать
                                </button>
                            </Link>
                        </div>
                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-8">
                    {/* Recommended Personnel Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="font-bold text-[#111827] dark:text-white">Рекомендованные ответственные</h3>
                            <div className="text-[#8B5CF6]">
                                <CheckCircle2 size={18} fill="currentColor" className="text-white dark:text-gray-900" />
                                <Zap size={18} fill="currentColor" strokeWidth={0} className="-ml-3 inline" />
                            </div>
                        </div>

                        <div className="space-y-6">
                            {personnel.map((person, i) => (
                                <div key={i} className="flex items-center gap-4 group">
                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white dark:border-gray-700 shadow-sm shrink-0">
                                        <img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-[#111827] dark:text-white text-sm group-hover:text-[#8B5CF6] transition-colors">{person.name}</div>
                                        <div className="text-[10px] font-black text-[#8B5CF6] tracking-widest mt-0.5">{person.role}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-8 border-t border-gray-50 dark:border-gray-700">
                            <p className="text-[11px] text-gray-400 font-medium italic leading-relaxed">
                                AI подобрал сотрудников на основе их опыта в аналогичных проектах и текущей загрузки.
                            </p>
                        </div>
                    </div>

                    {/* Accuracy Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-[#F9FAFB] dark:bg-[#F9FAFB]/10 rounded-lg">
                                <CheckCircle2 size={18} className="text-[#B1A289]" />
                            </div>
                            <h3 className="font-bold text-[#111827] dark:text-white">Контроль точности</h3>
                        </div>

                        <div className="relative pt-1">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[12px] font-medium text-gray-400">Точность распознавания</span>
                                <span className="text-[13px] font-bold text-[#111827] dark:text-white">98%</span>
                            </div>
                            <div className="flex h-2.5 overflow-hidden text-xs bg-[#F3F4F6] dark:bg-gray-700 rounded-full">
                                <div style={{ width: "98%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#C1B299]"></div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                                Все этапы были сопоставлены с внутренним регламентом качества.
                            </p>
                        </div>
                    </div>

                    {/* Download Button */}
                    <button className="w-full h-16 bg-[#F3EFE7] dark:bg-[#3d3a33] hover:bg-[#E9E1D3] dark:hover:bg-[#4a463d] text-[#2D2D2D] dark:text-[#E9DFBD] font-bold rounded-[22px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-sm">
                        <Download size={20} />
                        <span>Скачать структуру ЖЦП</span>
                    </button>
                </div>
            </div>
        </main>
    </div>
    );
}
