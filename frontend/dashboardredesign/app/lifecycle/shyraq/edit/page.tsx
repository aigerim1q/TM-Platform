'use client';

import Header from '@/components/header';
import { ArrowLeft, Rocket, Zap, CheckCircle2, RotateCcw, FileText, Calendar, Check, Download, Trash2, Edit2, User, ChevronRight, MoreVertical, Lightbulb, Plus, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function ShyraqEditPage() {
    const router = useRouter();
    const [isLoaded, setIsLoaded] = useState(false);
    const [projectStages, setProjectStages] = useState([
        { id: 1, title: 'Подготовительный этап и мобилизация ресурсов', duration: 14 },
        { id: 2, title: 'Разработка и утверждение проектно-сметной документации', duration: 45 },
        { id: 3, title: 'Закупка материалов и оборудования', duration: 30 },
        { id: 4, title: 'Строительно-монтажные работы (СМР)', duration: 180 },
        { id: 5, title: 'Пусконаладочные работы и тестирование систем', duration: 21 },
        { id: 6, title: 'Ввод в эксплуатацию и передача заказчику', duration: 10 },
    ]);

    const [deadline, setDeadline] = useState("09/15/2026");
    const [finModel, setFinModel] = useState("Смета (Fixed Price)");

    const personnel = [
        { name: 'Омар Ахмет', role: 'РУКОВОДИТЕЛЬ ПРОЕКТА', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
        { name: 'Расул Даулетов', role: 'ТЕХНИЧЕСКИЙ ДИРЕКТОР', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=100&h=100&fit=crop' },
        { name: 'Айдын Рахимбаев', role: 'ГЛАВНЫЙ ИНЖЕНЕР', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
    ];

    const removeStage = (id: number) => {
        setProjectStages(projectStages.filter(s => s.id !== id));
    };

    const addStage = () => {
        const newId = projectStages.length > 0 ? Math.max(...projectStages.map(s => s.id)) + 1 : 1;
        setProjectStages([...projectStages, { id: newId, title: '', duration: 0 }]);
    };

    // Load from localStorage on mount
    useEffect(() => {
        const savedData = localStorage.getItem('shyraq_project_data');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            setProjectStages(parsed.stages);
            setDeadline(parsed.deadline);
            setFinModel(parsed.finModel);
        }
        setIsLoaded(true);
    }, []);

    const handleSave = () => {
        const dataToSave = {
            stages: projectStages,
            deadline: deadline,
            finModel: finModel
        };
        localStorage.setItem('shyraq_project_data', JSON.stringify(dataToSave));
        router.push('/lifecycle/shyraq');
    };

    if (!isLoaded) return null; // Avoid hydration mismatch or flash of default data

    return (
        <div className="min-h-screen bg-[#FDFDFE] dark:bg-background">
            <Header />

            <main className="pt-24 pb-16 px-6 max-w-7xl mx-auto">
                {/* Back Button and Subheader */}
                <div className="flex flex-col gap-8 mb-10">
                    <div>
                        <Link href="/lifecycle/shyraq">
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-[#D1C4AE]/90 hover:bg-[#D1C4AE] dark:bg-[#4a4225] dark:hover:bg-[#5c5230] text-[#2D2D2D] dark:text-amber-50 font-medium rounded-full transition-all text-sm shadow-sm active:scale-95">
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
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FDF4EB] dark:bg-[#FDF4EB]/10 text-[#D97706] dark:text-[#fbbf24] rounded-full text-[11px] font-bold tracking-tight uppercase">
                                    <Rocket size={12} fill="currentColor" strokeWidth={0} />
                                    <span>Режим редактирования</span>
                                </div>
                            </div>
                            <h1 className="text-[32px] font-extrabold text-[#111827] dark:text-white mb-2 tracking-tight">Редактирование ЖЦП: Shyraq</h1>
                            <p className="text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed text-[15px]">
                                Настройте структуру жизненного цикла проекта вручную. Измените параметры, добавьте или удалите этапы.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
                    {/* Main Edit Area */}
                    <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 p-10 shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-none">
                        {/* Basic Parameters */}
                        <div className="mb-12">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <MoreVertical size={20} className="text-gray-400 dark:text-gray-300 rotate-90" />
                                </div>
                                <h3 className="text-lg font-bold text-[#111827] dark:text-white">Основные параметры</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Deadline input */}
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block">
                                        Срок завершения (Дедлайн)
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#F9FAFB] dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600 flex items-center justify-center pointer-events-none">
                                            <Calendar size={18} className="text-gray-400 dark:text-gray-300" />
                                        </div>
                                        <input
                                            type="text"
                                            value={deadline}
                                            onChange={(e) => setDeadline(e.target.value)}
                                            className="w-full bg-[#FAFBFC] dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[20px] py-4 pl-16 pr-14 font-bold text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                                        />
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <Calendar size={18} />
                                        </div>
                                    </div>
                                </div>

                                {/* Financial model input */}
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block">
                                        Финансовая модель
                                    </label>
                                    <div className="relative group cursor-pointer">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#FDF4EB] dark:bg-[#FDF4EB]/10 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center justify-center pointer-events-none">
                                            <Lightbulb size={18} className="text-[#D97706] dark:text-amber-500" fill="#D97706" fillOpacity={0.1} />
                                        </div>
                                        <select
                                            value={finModel}
                                            onChange={(e) => setFinModel(e.target.value)}
                                            className="w-full bg-[#FAFBFC] dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[20px] py-4 pl-16 pr-14 font-bold text-[#111827] dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#D97706]/20 transition-all cursor-pointer"
                                        >
                                            <option>Смета (Fixed Price)</option>
                                            <option>T&M (Time and Materials)</option>
                                            <option>Cost Plus</option>
                                        </select>
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Project Stages (ЖЦП) */}
                        <div>
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">ЭТАПЫ ПРОЕКТА (ЖЦП)</h3>
                            </div>

                            <div className="space-y-4">
                                {projectStages.map((stage, index) => (
                                    <div key={stage.id} className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="flex-1 bg-[#FAFBFC] dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[22px] p-5 flex items-center gap-5">
                                            <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm text-gray-400 dark:text-gray-500 font-bold shrink-0">
                                                {index + 1}
                                            </div>
                                            <input
                                                type="text"
                                                value={stage.title}
                                                onChange={(e) => {
                                                    const newStages = [...projectStages];
                                                    const idx = newStages.findIndex(s => s.id === stage.id);
                                                    newStages[idx].title = e.target.value;
                                                    setProjectStages(newStages);
                                                }}
                                                className="flex-1 bg-transparent border-0 font-bold text-[#111827] dark:text-white text-[15px] focus:ring-0 focus:outline-none min-w-0"
                                                placeholder="Введите название этапа..."
                                            />
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2">
                                                    <input
                                                        type="number"
                                                        value={stage.duration}
                                                        onChange={(e) => {
                                                            const newStages = [...projectStages];
                                                            const idx = newStages.findIndex(s => s.id === stage.id);
                                                            newStages[idx].duration = parseInt(e.target.value) || 0;
                                                            setProjectStages(newStages);
                                                        }}
                                                        className="w-10 bg-transparent border-0 font-bold text-[#111827] dark:text-white text-sm text-right focus:ring-0 p-0"
                                                    />
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-tight ml-1">дн</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeStage(stage.id)}
                                            className="w-12 h-12 rounded-[18px] border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}

                                {/* Add new stage button */}
                                <button
                                    onClick={addStage}
                                    className="w-full h-16 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-[22px] flex items-center justify-center gap-3 text-gray-400 dark:text-gray-500 font-bold hover:border-[#6366F1]/30 hover:text-[#6366F1]/70 transition-all group"
                                >
                                    <div className="w-6 h-6 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center group-hover:bg-[#EEF2FF] dark:group-hover:bg-[#EEF2FF]/10">
                                        <Plus size={16} />
                                    </div>
                                    <span>Добавить новый этап</span>
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-4 mt-12 pt-8 border-t border-gray-100">
                            <button
                                onClick={handleSave}
                                className="flex-1 min-w-[200px] flex items-center justify-center gap-3 px-8 py-4.5 bg-[#D1C4AE] hover:bg-[#C1B299] text-white font-bold rounded-[22px] shadow-lg shadow-[#D1C4AE]/20 transition-all hover:-translate-y-1 active:scale-95"
                            >
                                <span className="text-lg text-white/95">Сохранить изменения</span>
                                <CheckCircle2 size={24} fill="white" className="text-[#D1C4AE]" strokeWidth={1} />
                            </button>
                            <Link href="/lifecycle/shyraq">
                                <button className="px-12 py-4.5 bg-[#FAFBFC]/80 dark:bg-gray-800 border-2 border-transparent text-gray-500 dark:text-gray-400 font-bold rounded-[22px] transition-all hover:bg-gray-100 dark:hover:bg-gray-700 text-lg">
                                    Отмена
                                </button>
                            </Link>
                        </div>
                    </div>

                    {/* Sidebar Area (Static/Disabled) */}
                    <div className="space-y-8 opacity-40 grayscale pointer-events-none select-none">
                        {/* Recommended Personnel Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="font-bold text-[#111827] dark:text-white">Рекомендованные ответственные</h3>
                                <div className="text-[#8B5CF6]">
                                    <CheckCircle2 size={18} fill="currentColor" className="text-white dark:text-gray-800" />
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
                                            <div className="font-bold text-[#111827] dark:text-white text-sm">{person.name}</div>
                                            <div className="text-[10px] font-black text-[#8B5CF6] tracking-widest mt-0.5">{person.role}</div>
                                        </div>
                                    </div>
                                ))}
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
                                <div className="flex h-2.5 overflow-hidden text-xs bg-[#F3F4F6] dark:bg-gray-700 rounded-full">
                                    <div style={{ width: "98%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#C1B299]"></div>
                                </div>
                            </div>
                        </div>

                        {/* Download Button */}
                        <div className="w-full h-16 bg-[#F3EFE7] dark:bg-[#F3EFE7]/10 text-[#2D2D2D]/40 dark:text-[#E9DFBD]/40 font-bold rounded-[22px] flex items-center justify-center gap-3 border border-gray-100 dark:border-gray-700">
                            <Download size={20} />
                            <span>Скачать структуру ЖЦП</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
