'use client';

import { Check, Shield, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import { getDisplayNameFromEmail } from '@/lib/utils';

interface ResponsiblePerson {
    id: string;
    name: string;
    role?: string;
    avatar?: string;
}

interface ResponsiblePersonsModalProps {
    isOpen: boolean;
    onClose: () => void;
    persons?: ResponsiblePerson[];
    projectId?: string;
    userRole?: 'owner' | 'manager' | 'member';
    onChanged?: () => Promise<void> | void;
}

type UserEntity = {
    id: string;
    email: string;
};

type ProjectMemberEntity = {
    user: {
        id: string;
        email: string;
    };
    role: 'owner' | 'manager' | 'member';
};

type RolesState = {
    managerId: string;
    memberIds: string[];
};

function getRoleBadgeClasses(role: string) {
    if (role === 'owner') {
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    }
    if (role === 'manager') {
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    }
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
}

function getInitials(email: string) {
    const trimmed = email.trim();
    if (!trimmed) return 'U';
    return trimmed.slice(0, 2).toUpperCase();
}

function getAvatarColor(seed: string) {
    const palette = [
        'bg-rose-100 text-rose-700',
        'bg-sky-100 text-sky-700',
        'bg-emerald-100 text-emerald-700',
        'bg-violet-100 text-violet-700',
        'bg-orange-100 text-orange-700',
        'bg-cyan-100 text-cyan-700',
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash + seed.charCodeAt(i)) % palette.length;
    }
    return palette[hash];
}

export default function ResponsiblePersonsModal({
    isOpen,
    onClose,
    persons,
    projectId,
    userRole,
    onChanged,
}: ResponsiblePersonsModalProps) {
    const [mode, setMode] = useState<'manager' | 'members'>('manager');
    const [users, setUsers] = useState<UserEntity[]>([]);
    const [members, setMembers] = useState<ProjectMemberEntity[]>([]);
    const [roles, setRoles] = useState<RolesState>({ managerId: '', memberIds: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const membersMap = useMemo<Map<string, ProjectMemberEntity['role']>>(() => {
        return new Map(members.map((member) => [member.user.id, member.role]));
    }, [members]);
    const isReadOnlyMember = userRole === 'member';

    const canSave = Boolean(projectId && roles.managerId) && !isSaving && !isReadOnlyMember;

    useEffect(() => {
        if (!isOpen || !projectId) return;

        let cancelled = false;
        setMode('manager');

        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [{ data: usersData }, { data: membersData }] = await Promise.all([
                    api.get<UserEntity[]>('/users'),
                    api.get<ProjectMemberEntity[]>(`/projects/${projectId}/members`),
                ]);

                if (cancelled) return;

                setUsers(Array.isArray(usersData) ? usersData : []);
                const normalizedMembers = Array.isArray(membersData) ? membersData : [];
                setMembers(normalizedMembers);

                const manager = normalizedMembers.find((member) => member.role === 'manager');
                const memberIds = normalizedMembers
                    .filter((member) => member.role === 'member')
                    .map((member) => member.user.id);

                setRoles({
                    managerId: manager?.user.id || '',
                    memberIds,
                });
            } catch (e) {
                if (cancelled) return;
                setError(getApiErrorMessage(e, 'Не удалось загрузить участников проекта'));
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [isOpen, projectId]);

    const reloadMembers = async () => {
        if (!projectId) return;
        const { data: membersData } = await api.get<ProjectMemberEntity[]>(`/projects/${projectId}/members`);
        const normalizedMembers = Array.isArray(membersData) ? membersData : [];
        setMembers(normalizedMembers);

        const manager = normalizedMembers.find((member) => member.role === 'manager');
        const memberIds = normalizedMembers
            .filter((member) => member.role === 'member')
            .map((member) => member.user.id);

        setRoles({
            managerId: manager?.user.id || '',
            memberIds,
        });
    };

    const handleUserClick = async (user: UserEntity) => {
        if (isReadOnlyMember || isSaving || isLoading) return;

        const currentRole = membersMap.get(user.id);
        if (mode === 'manager') {
            if (currentRole === 'owner') {
                setError('Владелец проекта не может быть назначен менеджером');
                return;
            }

            setRoles((prev) => ({
                managerId: user.id,
                memberIds: prev.memberIds.filter((id) => id !== user.id),
            }));
            return;
        }

        if (user.id === roles.managerId) {
            setError('Менеджер назначается во вкладке «Назначить менеджера»');
            return;
        }

        setRoles((prev) => {
            const exists = prev.memberIds.includes(user.id);
            return {
                ...prev,
                memberIds: exists
                    ? prev.memberIds.filter((id) => id !== user.id)
                    : [...prev.memberIds, user.id],
            };
        });
    };

    const saveRoles = async () => {
        if (!projectId || !canSave) return;

        setIsSaving(true);
        setError(null);
        try {
            await api.patch(`/projects/${projectId}/roles`, {
                managerId: roles.managerId,
                memberIds: roles.memberIds,
            });
            await reloadMembers();
            await onChanged?.();
        } catch (e) {
            setError(getApiErrorMessage(e, 'Не удалось сохранить роли'));
        } finally {
            setIsSaving(false);
        }
    };

    const fallbackPersons = persons ?? [];
    const renderUsers = isReadOnlyMember
        ? members.map((member) => ({
            id: member.user.id,
            name: getDisplayNameFromEmail(member.user.email),
            role: member.role,
            avatar: '',
        }))
        : users.length > 0
        ? users.map((u) => ({
            id: u.id,
            name: getDisplayNameFromEmail(u.email),
            role: membersMap.get(u.id),
            avatar: '',
        }))
        : fallbackPersons;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-[#F5F5F5] dark:bg-gray-900 rounded-4xl w-full max-w-150 mx-4 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                        <Users className="w-7 h-7 text-gray-900 dark:text-white" strokeWidth={1.8} />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {isReadOnlyMember ? 'Ответственные проекта' : 'Управление участниками'}
                            </h2>
                            {isReadOnlyMember && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">Режим просмотра</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isReadOnlyMember && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setMode('manager')}
                                    disabled={isSaving || !projectId}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-colors font-medium disabled:opacity-50 ${
                                        mode === 'manager'
                                            ? 'bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    Назначить менеджера
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('members')}
                                    disabled={isSaving || !projectId}
                                    className={`px-5 py-2.5 rounded-xl transition-colors font-medium disabled:opacity-50 ${
                                        mode === 'members'
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    Участники
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
                        >
                            <X className="w-6 h-6 text-gray-900 dark:text-white" strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5 max-h-125 overflow-y-auto">
                    {error && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    {isLoading && (
                        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">Загрузка участников...</div>
                    )}
                    {!isReadOnlyMember && (
                        <div className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {mode === 'manager' && 'Режим: кликните пользователя, чтобы назначить менеджером. Менеджер только один.'}
                            {mode === 'members' && 'Режим: кликните пользователя, чтобы добавить/убрать из участников.'}
                        </div>
                    )}

                    {/* Persons List */}
                    <div className="space-y-4 mb-8">
                        {renderUsers.map((person) => (
                            <div
                                key={person.id}
                                className={`flex items-center gap-4 py-2 rounded-xl px-2 ${
                                    !isSaving && !isReadOnlyMember
                                        ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'
                                        : 'cursor-default opacity-80'
                                }`}
                                onClick={() => {
                                    const user = users.find((u) => u.id === person.id);
                                    if (user) {
                                        void handleUserClick(user);
                                    }
                                }}
                            >
                                {/* Avatar */}
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${getAvatarColor(person.id)}`}>
                                    {getInitials(person.name)}
                                </div>

                                {/* Info */}
                                <div className="flex-1">
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-0.5">
                                        {person.name}
                                    </h3>
                                </div>

                                {person.role === 'owner' && (
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClasses('owner')}`}>
                                        owner
                                    </span>
                                )}

                                {roles.managerId === person.id && person.role !== 'owner' && (
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClasses('manager')}`}>
                                        manager
                                    </span>
                                )}

                                {roles.memberIds.includes(person.id) && (
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClasses('member')}`}>
                                        member
                                    </span>
                                )}

                                {!isReadOnlyMember && mode === 'members' && roles.memberIds.includes(person.id) && (
                                    <Check className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                                )}

                                {!isReadOnlyMember && mode === 'manager' && roles.managerId === person.id && (
                                    <Shield className="w-5 h-5 text-amber-600 dark:text-amber-300" />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                            Закрыть
                        </button>
                        {!isReadOnlyMember && (
                            <button
                                type="button"
                                onClick={() => void saveRoles()}
                                disabled={!canSave}
                                className="rounded-full bg-yellow-600 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-700 disabled:opacity-60"
                            >
                                {isSaving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
