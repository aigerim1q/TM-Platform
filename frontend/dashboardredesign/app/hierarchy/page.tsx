'use client';

import { useEffect, useMemo, useState } from 'react';

import Header from '@/components/header';
import { HierarchyNode } from '@/components/hierarchy-node';
import { getApiErrorMessage } from '@/lib/api';
import { getDisplayNameFromEmail } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  assignUserToHierarchy,
  createHierarchyNode,
  deleteHierarchyNode,
  getHierarchyTree,
  listUsers,
  updateHierarchyNode,
  updateNodeStatus,
  type HierarchyCatalogItem,
  type HierarchyTreeNode,
  type UserPublic,
} from '@/lib/users';

function roleLabel(role?: string | null): string {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'owner') return 'Owner';
  if (value === 'hr' || value === 'human resources') return 'HR';
  if (value === 'hr_manager' || value === 'hr manager') return 'HR Manager';
  if (value === 'manager') return 'Manager';
  if (!value) return 'Не указана';
  return role || 'Не указана';
}

function canManageHierarchyByUser(user?: Pick<UserPublic, 'role' | 'manager_id'> | null): boolean {
  if (!user) return false;
  const role = String(user.role || '').trim().toLowerCase();
  const roleAllows = role === 'owner' || role === 'hr' || role === 'hr_manager' || role === 'hr manager' || role === 'human resources';
  const managerRoot = user.manager_id === null || user.manager_id === undefined || user.manager_id === '';
  return roleAllows || managerRoot;
}

function permissionLabel(user?: Pick<UserPublic, 'role' | 'manager_id'> | null): string {
  return canManageHierarchyByUser(user) ? 'Управление иерархией (edit)' : 'Только просмотр';
}

export default function HierarchyPage() {
  const [nodes, setNodes] = useState<HierarchyTreeNode[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<HierarchyTreeNode | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [users, setUsers] = useState<UserPublic[]>([]);
  const [departmentCatalog, setDepartmentCatalog] = useState<HierarchyCatalogItem[]>([]);
  const [roleCatalog, setRoleCatalog] = useState<HierarchyCatalogItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserRoleTitle, setSelectedUserRoleTitle] = useState('');
  const [selectedAssignRoleTemplate, setSelectedAssignRoleTemplate] = useState('');
  const [nodeTitle, setNodeTitle] = useState('');
  const [selectedDepartmentTemplate, setSelectedDepartmentTemplate] = useState('');
  const [newDepartmentTitle, setNewDepartmentTitle] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [selectedRoleTemplate, setSelectedRoleTemplate] = useState('');
  const [nodeStatus, setNodeStatus] = useState<'free' | 'busy' | 'sick'>('free');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const selectedNodeType = selectedNode?.type || 'company';
  const canRenameNode = canEdit && selectedNode != null && selectedNodeType !== 'company' && selectedNodeType !== 'user';
  const canAddDepartment = canEdit && selectedNode != null && selectedNodeType !== 'user';
  const canAssign = canEdit && selectedNode != null && selectedNodeType !== 'user';
  const canSetRole = canEdit && selectedNode != null && selectedNodeType === 'user';
  const hasBoundUser = selectedNode?.user_id != null;
  const isUserNode = selectedNodeType === 'user';
  const isOwnNode = hasBoundUser && currentUserId != null && selectedNode?.user_id === currentUserId;
  const canChangeStatus = hasBoundUser && (canEdit || isOwnNode);
  const canDelete = canEdit && selectedNode != null && selectedNodeType !== 'company';
  const assignLabel = selectedNodeType === 'company'
    ? 'Назначить CEO'
    : selectedNodeType === 'department'
      ? 'Назначить сотрудника в отдел'
      : 'Назначить сотрудника';
  const assignButtonLabel = selectedNodeType === 'company' ? 'Назначить CEO' : 'Назначить сотрудника';
  const departmentSectionLabel = selectedNodeType === 'department'
    ? 'Добавить поддепартамент (список + свой)'
    : 'Добавить отдел / подразделение (список + свой)';
  const addCatalogDepartmentButtonLabel = selectedNodeType === 'department'
    ? 'Добавить выбранный поддепартамент'
    : 'Добавить выбранный департамент';
  const customDepartmentPlaceholder = selectedNodeType === 'department'
    ? 'Или введите название поддепартамента'
    : 'Или введите свой департамент';
  const createDepartmentButtonLabel = selectedNodeType === 'department'
    ? 'Добавить поддепартамент'
    : 'Добавить отдел';

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aName = (a.full_name?.trim() || getDisplayNameFromEmail(a.email) || a.email).toLowerCase();
      const bName = (b.full_name?.trim() || getDisplayNameFromEmail(b.email) || b.email).toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [users]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return users.find((u) => u.id === selectedUserId) || null;
  }, [selectedUserId, users]);

  const sortedDepartmentCatalog = useMemo(() => {
    return [...departmentCatalog].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [departmentCatalog]);

  const sortedRoleCatalog = useMemo(() => {
    return [...roleCatalog].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [roleCatalog]);

  const hierarchyRoleByUserId = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (items: HierarchyTreeNode[]) => {
      for (const item of items) {
        if (item.user_id && item.role_title && item.role_title.trim()) {
          map.set(item.user_id, item.role_title.trim());
        }
        if (item.children?.length) {
          walk(item.children);
        }
      }
    };
    walk(nodes);
    return map;
  }, [nodes]);

  const loadTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getHierarchyTree();
      setNodes(Array.isArray(data.tree) ? data.tree : []);
      setCanEdit(Boolean(data.permissions?.can_edit));
      setCurrentUserId(data.current_user_id || null);
      const catalogs = data.catalogs;
      setDepartmentCatalog(Array.isArray(catalogs?.departments) ? catalogs.departments : []);
      setRoleCatalog(Array.isArray(catalogs?.roles) ? catalogs.roles : []);
    } catch {
      setError('Ошибка загрузки дерева иерархии');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTree();
    listUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const openNodeModal = (node: HierarchyTreeNode) => {
    setSelectedNode(node);
    setNodeTitle(node.title || '');
    setNewDepartmentTitle('');
    setRoleTitle(node.role_title || '');
    setNodeStatus((node.status as 'free' | 'busy' | 'sick') || 'free');
    setSelectedUserId('');
    setSelectedUserRoleTitle('');
    setSelectedAssignRoleTemplate('');
    setSelectedDepartmentTemplate('');
    setSelectedRoleTemplate(node.role_title || '');
    setIsModalOpen(true);
  };

  const closeNodeModal = () => {
    setIsModalOpen(false);
    setIsDeleteDialogOpen(false);
    setSelectedNode(null);
  };

  const handleRenameNode = async () => {
    if (!selectedNode || !canRenameNode) return;
    const title = nodeTitle.trim();
    if (!title) return;

    setIsSaving(true);
    try {
      await updateHierarchyNode(selectedNode.id, { title });
      await loadTree();
      closeNodeModal();
    } catch {
      setError('Не удалось обновить узел');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNode = async (title: string) => {
    if (!selectedNode || !canAddDepartment) return;
    const value = title.trim();
    if (!value) return;

    setIsSaving(true);
    try {
      await createHierarchyNode({
        title: value,
        type: 'department',
        parent_id: selectedNode.id,
      });
      await loadTree();
      closeNodeModal();
    } catch {
      setError('Не удалось создать отдел');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNodeFromCatalog = async () => {
    if (!selectedDepartmentTemplate) return;
    await handleCreateNode(selectedDepartmentTemplate);
  };

  const handleSetRole = async () => {
    if (!selectedNode || !canSetRole) return;

    setIsSaving(true);
    try {
      await updateHierarchyNode(selectedNode.id, { role_title: roleTitle.trim() || null });
      await loadTree();
      closeNodeModal();
    } catch {
      setError('Не удалось обновить роль');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignUser = async () => {
    if (!selectedNode || !canAssign || !selectedUserId) return;

    setIsSaving(true);
    try {
      const assignedNode = await assignUserToHierarchy({ node_id: selectedNode.id, user_id: selectedUserId });
      const roleTitleValue = selectedUserRoleTitle.trim();
      if (assignedNode?.id && roleTitleValue) {
        await updateHierarchyNode(assignedNode.id, { role_title: roleTitleValue });
      }
      await loadTree();
      closeNodeModal();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось назначить пользователя'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (status: 'free' | 'busy' | 'sick') => {
    if (!selectedNode) return;
    setIsSaving(true);
    try {
      await updateNodeStatus(selectedNode.id, status);
      setNodeStatus(status);
      await loadTree();
    } catch {
      setError('Не удалось обновить статус');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode || !canDelete) return;

    setIsSaving(true);
    try {
      await deleteHierarchyNode(selectedNode.id);
      await loadTree();
      setIsDeleteDialogOpen(false);
      closeNodeModal();
    } catch {
      setError('Не удалось удалить узел');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <Header />

      <div className="px-6 pb-10 pt-28">
        <h1 className="text-center text-2xl font-semibold text-gray-900 dark:text-white">
          Иерархия строительной компании
        </h1>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          Организационная структура компании
        </p>

        {!canEdit && !loading && (
          <p className="mt-4 text-center text-xs text-gray-500">Режим просмотра: только чтение.</p>
        )}

        {loading && <p className="mt-8 text-center text-sm text-gray-500">Загрузка...</p>}
        {error && !loading && <p className="mt-8 text-center text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="org-chart mt-8">
            <ul>
              {nodes.map((node) => (
                <HierarchyNode key={node.id} node={node} onNodeClick={openNodeModal} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── HR Edit Modal ──────────────────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) closeNodeModal(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Редактирование узла</DialogTitle>
            <DialogDescription>
              {selectedNode
                ? selectedNode.type === 'company'
                  ? 'Компания'
                  : `${selectedNode.type === 'department' ? 'Отдел' : 'Сотрудник'}: ${selectedNode.title}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedNode && (
            <div className="space-y-5">
              {/* Rename */}
              {selectedNodeType !== 'company' && (
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input
                    value={nodeTitle}
                    onChange={(e) => setNodeTitle(e.target.value)}
                    disabled={!canRenameNode || isSaving}
                    placeholder="Введите название..."
                  />
                  {canRenameNode && (
                    <Button
                      size="sm"
                      onClick={() => void handleRenameNode()}
                      disabled={isSaving || !nodeTitle.trim()}
                    >
                      Сохранить
                    </Button>
                  )}
                </div>
              )}

              {/* Assign user to department */}
              {canAssign && (
                <div className="space-y-2">
                  <Label>{assignLabel}</Label>
                  <select
                    className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={selectedUserId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedUserId(value);
                      const mappedRole = value ? (hierarchyRoleByUserId.get(value) || '') : '';
                      setSelectedUserRoleTitle(mappedRole);
                      setSelectedAssignRoleTemplate(mappedRole);
                    }}
                    disabled={isSaving}
                  >
                    <option value="">Выберите пользователя...</option>
                    {sortedUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name?.trim() || getDisplayNameFromEmail(user.email) || user.email}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleAssignUser()}
                    disabled={!selectedUserId || isSaving}
                  >
                    {assignButtonLabel}
                  </Button>

                  <div className="space-y-1">
                    <Label className="text-xs">Должность в иерархии (список + своя)</Label>
                    <select
                      className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                      value={selectedAssignRoleTemplate}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedAssignRoleTemplate(value);
                        if (value) {
                          setSelectedUserRoleTitle(value);
                        }
                      }}
                      disabled={isSaving || !selectedUserId}
                    >
                      <option value="">Выберите из списка...</option>
                      {sortedRoleCatalog.map((role) => (
                        <option key={role.id} value={role.name}>{role.name}</option>
                      ))}
                    </select>
                    <Input
                      value={selectedUserRoleTitle}
                      onChange={(e) => setSelectedUserRoleTitle(e.target.value)}
                      disabled={isSaving || !selectedUserId}
                      placeholder="Или введите свою должность"
                    />
                  </div>

                </div>
              )}

              {/* Set role for user node */}
              {canSetRole && isUserNode && (
                <div className="space-y-2">
                  <Label>Должность (список + своя)</Label>
                  <select
                    className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={selectedRoleTemplate}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedRoleTemplate(value);
                      if (value) {
                        setRoleTitle(value);
                      }
                    }}
                    disabled={isSaving}
                  >
                    <option value="">Выберите из списка...</option>
                    {sortedRoleCatalog.map((role) => (
                      <option key={role.id} value={role.name}>{role.name}</option>
                    ))}
                  </select>
                  <Input
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    disabled={isSaving}
                    placeholder="Или введите свою должность"
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleSetRole()}
                    disabled={isSaving}
                  >
                    Сохранить роль
                  </Button>
                </div>
              )}

              {/* Status selector — visible for any node with bound user (user/company) */}
              {canChangeStatus && (
                <div className="space-y-2">
                  <Label>{selectedNodeType === 'company' ? 'Статус CEO' : 'Статус сотрудника'}</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleStatusChange('free')}
                      disabled={isSaving}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        nodeStatus === 'free'
                          ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                          : 'bg-gray-100 text-gray-600 hover:bg-emerald-50'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Свободен
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusChange('busy')}
                      disabled={isSaving}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        nodeStatus === 'busy'
                          ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400'
                          : 'bg-gray-100 text-gray-600 hover:bg-amber-50'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Занят
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusChange('sick')}
                      disabled={isSaving}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        nodeStatus === 'sick'
                          ? 'bg-red-100 text-red-800 ring-2 ring-red-400'
                          : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Болен
                    </button>
                  </div>
                  {!canEdit && (
                    <p className="text-xs text-gray-400">Вы можете изменить только свой статус.</p>
                  )}
                </div>
              )}

              {/* Add department */}
              {canAddDepartment && (
                <div className="space-y-2">
                  <Label>{departmentSectionLabel}</Label>
                  <select
                    className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={selectedDepartmentTemplate}
                    onChange={(e) => setSelectedDepartmentTemplate(e.target.value)}
                    disabled={isSaving}
                  >
                    <option value="">Выберите из статичных...</option>
                    {sortedDepartmentCatalog.map((department) => (
                      <option key={department.id} value={department.name}>{department.name}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCreateNodeFromCatalog()}
                    disabled={isSaving || !selectedDepartmentTemplate}
                  >
                    {addCatalogDepartmentButtonLabel}
                  </Button>
                  <Input
                    value={newDepartmentTitle}
                    onChange={(e) => setNewDepartmentTitle(e.target.value)}
                    disabled={isSaving}
                    placeholder={customDepartmentPlaceholder}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCreateNode(newDepartmentTitle)}
                    disabled={isSaving || !newDepartmentTitle.trim()}
                  >
                    {createDepartmentButtonLabel}
                  </Button>
                </div>
              )}

              {/* Read-only notice */}
              {!canEdit && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  У вас только read-only доступ (Member).
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {canDelete ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isSaving}
              >
                {isUserNode ? 'Удалить из иерархии' : 'Удалить отдел'}
              </Button>
            ) : <div />}
            <Button variant="ghost" onClick={closeNodeModal}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedNodeType === 'user' ? 'Удалить пользователя из иерархии?' : 'Удалить отдел?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedNode
                ? `Вы действительно хотите удалить «${selectedNode.title}»? Действие удалит узел и его дочерние элементы.`
                : 'Это действие нельзя отменить.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteNode()}
              disabled={isSaving}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isSaving ? 'Удаляю...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
