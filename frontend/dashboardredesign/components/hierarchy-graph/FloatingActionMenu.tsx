'use client';

import { useEffect, useState } from 'react';
import { Activity, Check, Crown, Plus, UserPlus, UserRoundCog } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHierarchyGraphStore } from '@/store/useHierarchyGraphStore';
import { getFileUrl } from '@/lib/utils';

type FloatingActionMenuProps = {
  nodeId: string;
  nodeType: string;
  initialMode?: 'default' | 'role' | 'status' | 'ceo';
  onClose?: () => void;
};

type MenuMode = 'default' | 'create-department' | 'create-user' | 'role' | 'status' | 'ceo';

type UserStatus = 'free' | 'busy' | 'sick';

const USER_STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: 'free', label: 'Свободен' },
  { value: 'busy', label: 'Занят' },
  { value: 'sick', label: 'Болен' },
];

const DEPARTMENT_TEMPLATES = [
  'Отдел внутреннего аудита',
  'Архитектурно-проектный отдел',
  'Отдел дизайнеров',
  'ПТО',
  'Руководители строительных участков',
  'IT-отдел',
  'Отдел кадров (HR)',
  'Юридический отдел',
  'Коммерческий отдел / Отдел продаж',
];

const ROLE_TEMPLATES = [
  'Технический директор (главный инженер)',
  'Директор по строительству',
  'Внутренний аудитор',
  'Главный архитектор',
  'Архитектор',
  'Руководитель отдела дизайнеров',
  'Дизайнер интерьера',
  'Дизайнер экстерьера',
  'Начальник ПТО',
  'Инженер ПТО',
  'Руководитель группы прорабов',
  'Прораб',
  'Руководитель IT-отдела',
  'Frontend-разработчик',
  'Backend-разработчик',
  'IT-поддержка',
  'Руководитель HR-отдела',
  'HR-специалист',
];

export function FloatingActionMenu({ nodeId, nodeType, initialMode = 'default', onClose }: FloatingActionMenuProps) {
  const createNode = useHierarchyGraphStore((state) => state.createNode);
  const assignRole = useHierarchyGraphStore((state) => state.assignRole);
  const assignCEO = useHierarchyGraphStore((state) => state.assignCEO);
  const setUserStatus = useHierarchyGraphStore((state) => state.setUserStatus);
  const nodes = useHierarchyGraphStore((state) => state.nodes);
  const dbUsers = useHierarchyGraphStore((state) => state.dbUsers);
  const dbUsersLoading = useHierarchyGraphStore((state) => state.dbUsersLoading);
  const fetchDbUsers = useHierarchyGraphStore((state) => state.fetchDbUsers);
  const beginDraftCreation = useHierarchyGraphStore((state) => state.beginDraftCreation);
  const updateDraftTitle = useHierarchyGraphStore((state) => state.updateDraftTitle);
  const cancelDraftCreation = useHierarchyGraphStore((state) => state.cancelDraftCreation);

  const [mode, setMode] = useState<MenuMode>(initialMode);
  const [value, setValue] = useState('');
  const [roleValue, setRoleValue] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedDepartmentTemplate, setSelectedDepartmentTemplate] = useState('');

  const currentCEOUserId =
    nodes.find((node) => node.type === 'company')?.data.meta.userId ||
    nodes.find((node) => node.type === 'user' && Boolean(node.data.meta.isCEO))?.data.meta.userId ||
    null;

  const nonCeoUsers = dbUsers.filter((user) => user.id !== currentCEOUserId);
  const ceoCandidates = dbUsers.filter((user) => user.id !== currentCEOUserId);

  useEffect(() => {
    setMode(initialMode);
    setValue('');
    setRoleValue('');
    setSelectedUserId('');
    setSelectedDepartmentTemplate('');
  }, [initialMode, nodeId]);

  useEffect(() => {
    if (mode === 'create-user' || mode === 'ceo') {
      void fetchDbUsers();
    }
  }, [fetchDbUsers, mode]);

  useEffect(() => {
    if (mode !== 'ceo' && mode !== 'create-user') return;
    if (!selectedUserId) return;

    const sourceUsers = mode === 'ceo' ? ceoCandidates : nonCeoUsers;
    const stillSelectable = sourceUsers.some((user) => user.id === selectedUserId);
    if (!stillSelectable) {
      setSelectedUserId('');
      setValue('');
    }
  }, [ceoCandidates, mode, nonCeoUsers, selectedUserId]);

  useEffect(() => {
    if (mode === 'create-department' || mode === 'create-user') {
      beginDraftCreation(nodeId, mode === 'create-user' ? 'user' : 'department');
      return;
    }

    cancelDraftCreation();
  }, [beginDraftCreation, cancelDraftCreation, mode, nodeId]);

  const handleChange = (next: string) => {
    setValue(next);

    if (mode === 'create-department' || mode === 'create-user') {
      updateDraftTitle(next);
    }
  };

  const handleSubmit = async () => {
    const prepared = value.trim();

    if (mode === 'create-department') {
      const finalTitle = (prepared || selectedDepartmentTemplate).trim();
      if (!finalTitle) return;
      await createNode({ parentNodeId: nodeId, type: 'department', title: finalTitle });
      setMode('default');
      setValue('');
      setSelectedDepartmentTemplate('');
      return;
    }

    if (mode === 'create-user') {
      if (!selectedUserId) return;
      const selectedUser = dbUsers.find((user) => user.id === selectedUserId);
      if (!selectedUser) return;

      await createNode({
        parentNodeId: nodeId,
        type: 'user',
        title: selectedUser.full_name?.trim() || selectedUser.email,
        userId: selectedUser.id,
        avatarUrl: selectedUser.avatar_url || null,
        roleTitle: roleValue.trim() || undefined,
      });

      setMode('default');
      setValue('');
      setRoleValue('');
      setSelectedUserId('');
      return;
    }

    if (mode === 'ceo') {
      if (!selectedUserId) return;
      await assignCEO(nodeId, selectedUserId);

      setMode('default');
      setSelectedUserId('');
      onClose?.();
      return;
    }

    if (mode === 'role') {
      if (!prepared) return;
      await assignRole(nodeId, prepared);
      onClose?.();
      return;
    }
  };

  const canCreateDepartment = nodeType === 'company' || nodeType === 'department';
  const canCreateUser = nodeType === 'department';
  const canAssignRole = nodeType === 'user';
  const canChangeStatus = nodeType === 'user';
  const canAssignCEO = nodeType === 'company';

  return (
    <div className="nodrag nopan absolute left-full top-0 z-50 ml-3 w-72 rounded-xl border border-slate-200 bg-white/95 p-2 text-slate-900 shadow-2xl backdrop-blur dark:border-white/15 dark:bg-slate-950/95 dark:text-slate-100">
      {mode === 'default' ? (
        <div className="space-y-1">
          {canCreateDepartment && (
            <>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                onClick={() => setMode('create-department')}
              >
                <Plus size={14} />
                Create Department
              </button>
            </>
          )}
          {canCreateUser && (
            <>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                onClick={() => setMode('create-user')}
              >
                <UserPlus size={14} />
                Create User
              </button>
            </>
          )}
          {canAssignRole && (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
              onClick={() => setMode('role')}
            >
              <UserRoundCog size={14} />
              Assign Role
            </button>
          )}
          {canAssignCEO ? (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-amber-200 hover:bg-amber-400/15"
              onClick={() => setMode('ceo')}
            >
              <Crown size={14} />
              Назначить нового CEO
            </button>
          ) : canChangeStatus ? (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
              onClick={() => setMode('status')}
            >
              <Activity size={14} />
              Изменить статус
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
            {mode === 'create-department' && 'New department'}
            {mode === 'create-user' && 'New user'}
            {mode === 'role' && 'Assign role'}
            {mode === 'status' && 'Изменение статуса'}
            {mode === 'ceo' && 'Назначить CEO'}
          </p>

          {mode === 'status' ? (
            <div className="space-y-1">
              {USER_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  onClick={() => {
                    void setUserStatus(nodeId, option.value);
                    onClose?.();
                  }}
                >
                  <span>{option.label}</span>
                  <Check className="h-3 w-3 opacity-70" />
                </button>
              ))}

              <Button
                size="sm"
                variant="outline"
                className="mt-1 h-7 w-full border-slate-300 bg-transparent text-xs text-slate-700 dark:border-white/15 dark:text-slate-200"
                onClick={() => setMode('default')}
              >
                Назад
              </Button>
            </div>
          ) : (
            <>
              {mode === 'create-user' && (
                <div className="nowheel max-h-52 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-1 pr-1 dark:border-white/10 dark:bg-white/5">
                  {dbUsersLoading ? (
                    <p className="px-2 py-2 text-xs text-slate-300">Loading users...</p>
                  ) : (
                    nonCeoUsers.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-slate-300">Нет доступных пользователей</p>
                    ) : (
                    nonCeoUsers.map((user) => {
                      const avatar = getFileUrl(user.avatar_url) || user.avatar_url || '';
                      const isSelected = selectedUserId === user.id;

                      return (
                        <button
                          key={user.id}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                            isSelected
                              ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-100'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
                          }`}
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setValue(user.full_name?.trim() || user.email);
                          }}
                        >
                          <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                            {avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={avatar} alt={user.full_name || user.email} className="h-full w-full object-cover" />
                            ) : (
                              <UserPlus size={12} />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs">{user.full_name?.trim() || user.email}</span>
                            <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{user.email}</span>
                          </span>
                        </button>
                      );
                    }))
                  )}
                </div>
              )}

              {mode === 'ceo' && (
                <div className="nowheel max-h-52 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-1 pr-1 dark:border-white/10 dark:bg-white/5">
                  {dbUsersLoading ? (
                    <p className="px-2 py-2 text-xs text-slate-300">Loading users...</p>
                  ) : ceoCandidates.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-slate-300">Нет доступных кандидатов</p>
                  ) : (
                    ceoCandidates.map((user) => {
                      const avatar = getFileUrl(user.avatar_url) || user.avatar_url || '';
                      const isSelected = selectedUserId === user.id;

                      return (
                        <button
                          key={user.id}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                            isSelected
                              ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-100'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
                          }`}
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setValue(user.full_name?.trim() || user.email);
                          }}
                        >
                          <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                            {avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={avatar} alt={user.full_name || user.email} className="h-full w-full object-cover" />
                            ) : (
                              <UserPlus size={12} />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs">{user.full_name?.trim() || user.email}</span>
                            <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{user.email}</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {mode === 'create-department' && (
                <div className="nowheel max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-1 pr-1 dark:border-white/10 dark:bg-white/5">
                  <button
                    className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs ${
                      selectedDepartmentTemplate
                        ? 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                        : 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-100'
                    }`}
                    onClick={() => {
                      setSelectedDepartmentTemplate('');
                      handleChange('');
                    }}
                  >
                    Select department template
                  </button>
                  {DEPARTMENT_TEMPLATES.map((template) => {
                    const isSelected = selectedDepartmentTemplate === template;

                    return (
                      <button
                        key={template}
                        className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs ${
                          isSelected
                            ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-100'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
                        }`}
                        onClick={() => {
                          setSelectedDepartmentTemplate(template);
                          handleChange(template);
                        }}
                      >
                        {template}
                      </button>
                    );
                  })}
                </div>
              )}

              {mode === 'role' && (
                <div className="nowheel max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-1 pr-1 dark:border-white/10 dark:bg-white/5">
                  <button
                    className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs ${
                      value
                        ? 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                        : 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-100'
                    }`}
                    onClick={() => handleChange('')}
                  >
                    Choose role template
                  </button>
                  {ROLE_TEMPLATES.map((template) => {
                    const isSelected = value === template;

                    return (
                      <button
                        key={template}
                        className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs ${
                          isSelected
                            ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-100'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
                        }`}
                        onClick={() => handleChange(template)}
                      >
                        {template}
                      </button>
                    );
                  })}
                </div>
              )}

              {mode === 'create-user' && (
                <Input
                  className="h-8 border-slate-300 bg-white text-xs text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
                  value={roleValue}
                  onChange={(event) => setRoleValue(event.target.value)}
                  placeholder="Role for new user (optional)"
                />
              )}

              {mode !== 'create-user' && mode !== 'ceo' && (
                <Input
                  className="h-8 border-slate-300 bg-white text-xs text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
                  value={value}
                  onChange={(event) => handleChange(event.target.value)}
                  placeholder={mode === 'create-department' ? 'Custom department name' : 'Type value'}
                />
              )}

              <div className="flex items-center gap-1">
                <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => void handleSubmit()}>
                  <Check className="mr-1 h-3 w-3" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-slate-300 bg-transparent text-xs text-slate-700 dark:border-white/15 dark:text-slate-200"
                  onClick={() => {
                    setMode('default');
                    setValue('');
                    setSelectedUserId('');
                    setSelectedDepartmentTemplate('');
                  }}
                >
                  Back
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
