'use client';

import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react';
import { create } from 'zustand';

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
import {
  applyDagreLayout,
  buildGraphFromTree,
  type HierarchyGraphEdge,
  type HierarchyGraphNode,
} from '@/lib/hierarchy-graph';
import { getApiErrorMessage, getApiStatus } from '@/lib/api';

type Direction = 'TB' | 'LR';

const CEO_ROLE_TITLES = new Set(['генеральный директор']);
const HR_ROLE_TITLES = new Set(['hr-специалист', 'руководитель hr-отдела']);
const HR_DEPARTMENT_TITLES = new Set(['отдел кадров (hr)', 'hr', 'hr отдел', 'hr-отдел', 'отдел кадров']);

function normalizeValue(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function findUserHierarchyContext(
  tree: HierarchyTreeNode[],
  currentUserId: string | null,
): { roleTitle: string; departmentTitle: string } | null {
  if (!currentUserId) return null;

  let result: { roleTitle: string; departmentTitle: string } | null = null;

  const walk = (nodes: HierarchyTreeNode[], currentDepartmentTitle: string) => {
    for (const node of nodes) {
      const nextDepartmentTitle =
        node.type === 'department' ? (node.title || currentDepartmentTitle) : currentDepartmentTitle;

      if (node.user_id === currentUserId) {
        result = {
          roleTitle: normalizeValue(node.role_title),
          departmentTitle: normalizeValue(nextDepartmentTitle),
        };
        return;
      }

      if (node.children?.length) {
        walk(node.children, nextDepartmentTitle);
        if (result) return;
      }
    }
  };

  walk(tree, '');
  return result;
}

function hasHierarchyEditPermission(
  tree: HierarchyTreeNode[],
  users: UserPublic[],
  currentUserId: string | null,
): boolean {
  if (!currentUserId) return false;

  const hasAnyAssignedHierarchyUser = (() => {
    const stack = [...tree];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      if (node.user_id) return true;
      if (node.children?.length) stack.push(...node.children);
    }
    return false;
  })();

  // Bootstrap case: allow the first logged-in user to configure hierarchy
  // (e.g. assign self as CEO) when no hierarchy user nodes exist yet.
  if (!hasAnyAssignedHierarchyUser) return true;

  const context = findUserHierarchyContext(tree, currentUserId);
  if (context) {
    if (CEO_ROLE_TITLES.has(context.roleTitle)) return true;
    if (HR_ROLE_TITLES.has(context.roleTitle)) return true;
    if (HR_DEPARTMENT_TITLES.has(context.departmentTitle)) return true;
  }

  const profile = users.find((user) => user.id === currentUserId);
  const profileDepartment = normalizeValue(profile?.department_name);
  if (HR_DEPARTMENT_TITLES.has(profileDepartment)) return true;

  return false;
}

type DraftCreationType = 'department' | 'user';

type DraftCreation = {
  parentNodeId: string;
  type: DraftCreationType;
  title: string;
};

type CreateNodeInput = {
  parentNodeId: string;
  type: DraftCreationType;
  title: string;
  userId?: string;
  avatarUrl?: string | null;
  roleTitle?: string;
};

type UpdateNodeInput = {
  title?: string;
  subtitle?: string;
  meta?: Partial<HierarchyGraphNode['data']['meta']>;
};

type HierarchyGraphState = {
  nodes: HierarchyGraphNode[];
  edges: HierarchyGraphEdge[];
  dbUsers: UserPublic[];
  dbUsersLoading: boolean;
  departmentCatalog: HierarchyCatalogItem[];
  canEdit: boolean;
  currentUserId: string | null;
  loading: boolean;
  error: string | null;
  selectedNodeId: string | null;
  draftCreation: DraftCreation | null;
  direction: Direction;
  loadGraph: (silent?: boolean) => Promise<void>;
  fetchDbUsers: () => Promise<void>;
  setSelectedNode: (id: string | null) => void;
  onNodesChange: (changes: NodeChange<HierarchyGraphNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<HierarchyGraphEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  createNode: (input: CreateNodeInput) => Promise<void>;
  updateNode: (nodeId: string, input: UpdateNodeInput) => void;
  createEdge: (source: string, target: string, animated?: boolean) => void;
  setCEO: (nodeId: string) => void;
  beginDraftCreation: (parentNodeId: string, type: DraftCreationType) => void;
  updateDraftTitle: (title: string) => void;
  cancelDraftCreation: () => void;
  confirmDraftCreation: () => Promise<void>;
  assignRole: (nodeId: string, roleTitle: string) => Promise<void>;
  createDepartment: (parentNodeId: string, title: string) => Promise<void>;
  assignCEO: (companyNodeId: string, userId: string) => Promise<void>;
  renameNode: (nodeId: string, title: string) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  setUserStatus: (nodeId: string, status: 'free' | 'busy' | 'sick') => Promise<void>;
  moveUserNodeToTarget: (userNodeId: string, targetNodeId: string) => Promise<void>;
  relayout: (direction?: Direction) => void;
};

function toHierarchyTargetId(node?: HierarchyGraphNode): string | null {
  if (!node) return null;

  if (node.type === 'company' || node.type === 'department') {
    return node.data.meta.sourceHierarchyId || node.id;
  }

  if (node.type === 'user') {
    return node.data.meta.parentHierarchyId || null;
  }

  return null;
}

function createEdgeId(source: string, target: string) {
  return `edge:${source}->${target}:${Date.now()}`;
}

function nextPosition(parent: HierarchyGraphNode) {
  const randomOffset = Math.round((Math.random() - 0.5) * 180);
  return {
    x: parent.position.x + 260,
    y: parent.position.y + randomOffset,
  };
}

function resolveUserByTitle(users: UserPublic[], title: string) {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;

  const exact = users.find((user) => {
    const fullName = user.full_name?.trim().toLowerCase() || '';
    const email = user.email.trim().toLowerCase();
    return fullName === normalized || email === normalized;
  });

  if (exact) return exact;

  return (
    users.find((user) => {
      const fullName = user.full_name?.trim().toLowerCase() || '';
      const email = user.email.trim().toLowerCase();
      return fullName.includes(normalized) || email.includes(normalized);
    }) || null
  );
}

export const useHierarchyGraphStore = create<HierarchyGraphState>((set, get) => ({
  nodes: [],
  edges: [],
  dbUsers: [],
  dbUsersLoading: false,
  departmentCatalog: [],
  canEdit: false,
  currentUserId: null,
  loading: true,
  error: null,
  selectedNodeId: null,
  draftCreation: null,
  direction: 'TB',

  loadGraph: async (silent = false) => {
    if (!silent) {
      set({ loading: true, error: null });
    }

    try {
      const treeData = await getHierarchyTree();
      let users: UserPublic[] = get().dbUsers;
      try {
        const fetchedUsers = await listUsers();
        users = Array.isArray(fetchedUsers) ? fetchedUsers : [];
      } catch {
        users = Array.isArray(get().dbUsers) ? get().dbUsers : [];
      }
      const baseGraph = buildGraphFromTree(Array.isArray(treeData.tree) ? treeData.tree : []);
      const layouted = applyDagreLayout(baseGraph.nodes, baseGraph.edges, get().direction);
      const currentUserId = treeData.current_user_id || null;
      const userList = Array.isArray(users) ? users : [];

      set({
        nodes: layouted.nodes,
        edges: layouted.edges,
        dbUsers: userList,
        canEdit: Boolean(treeData.permissions?.can_edit),
        currentUserId,
        departmentCatalog: Array.isArray(treeData.catalogs?.departments) ? treeData.catalogs?.departments : [],
        loading: false,
      });
    } catch (err) {
      set({
        loading: silent ? get().loading : false,
        error: getApiErrorMessage(err, 'Не удалось загрузить граф иерархии'),
      });
    }
  },

  fetchDbUsers: async () => {
    set({ dbUsersLoading: true });

    try {
      const users = await listUsers();
      set({ dbUsers: Array.isArray(users) ? users : [], dbUsersLoading: false });
    } catch {
      set({ dbUsersLoading: false });
    }
  },

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection) => {
    if (!get().canEdit) return;
    if (!connection.source || !connection.target) return;

    get().createEdge(connection.source, connection.target, true);
  },

  createEdge: (source, target, animated = true) => {
    if (!get().canEdit) return;

    set((state) => ({
      edges: addEdge(
        {
          id: createEdgeId(source, target),
          source,
          target,
          type: 'smoothstep',
          data: { type: 'hierarchy' },
          animated,
        },
        state.edges,
      ),
    }));
  },

  updateNode: (nodeId, input) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== nodeId) return node;

        return {
          ...node,
          data: {
            ...node.data,
            title: input.title ?? node.data.title,
            subtitle: input.subtitle ?? node.data.subtitle,
            meta: {
              ...node.data.meta,
              ...(input.meta || {}),
            },
          },
        };
      }),
    }));
  },

  setCEO: (nodeId) => {
    if (!get().canEdit) return;

    const selectedUserNode = get().nodes.find((node) => node.id === nodeId && node.type === 'user');

    set((state) => ({
      nodes: state.nodes.map((node) => ({
        ...(node.type === 'company' && selectedUserNode
          ? {
              ...node,
              data: {
                ...node.data,
                title: selectedUserNode.data.title,
                subtitle: 'Корневой узел',
                meta: {
                  ...node.data.meta,
                  avatarUrl: selectedUserNode.data.meta.avatarUrl || null,
                  isCEO: false,
                },
              },
            }
          : {
              ...node,
              data: {
                ...node.data,
                meta: {
                  ...node.data.meta,
                  isCEO: node.id === nodeId,
                },
              },
            }),
      })),
    }));
  },

  beginDraftCreation: (parentNodeId, type) => {
    set({
      selectedNodeId: parentNodeId,
      draftCreation: { parentNodeId, type, title: '' },
    });
  },

  updateDraftTitle: (title) => {
    set((state) => ({
      draftCreation: state.draftCreation
        ? {
            ...state.draftCreation,
            title,
          }
        : null,
    }));
  },

  cancelDraftCreation: () => {
    set({ draftCreation: null });
  },

  confirmDraftCreation: async () => {
    const draft = get().draftCreation;
    if (!draft || !draft.title.trim()) return;

    await get().createNode({
      parentNodeId: draft.parentNodeId,
      type: draft.type,
      title: draft.title,
    });

    set({ draftCreation: null });
  },

  createNode: async ({ parentNodeId, type, title, roleTitle, userId, avatarUrl }) => {
    if (!get().canEdit) return;

    const { nodes, dbUsers } = get();
    const parentNode = nodes.find((node) => node.id === parentNodeId);
    const preparedTitle = title.trim();
    const parentHierarchyId = toHierarchyTargetId(parentNode);

    if (!parentNode || !parentHierarchyId || !preparedTitle) return;

    if (type === 'department') {
      const temporaryNodeId = `tmp:department:${Date.now()}`;

      set((state) => ({
        nodes: [
          ...state.nodes,
          {
            id: temporaryNodeId,
            type: 'department',
            draggable: true,
            position: nextPosition(parentNode),
            data: {
              title: preparedTitle,
              subtitle: 'Департамент',
              parentId: parentNodeId,
              meta: {
                parentHierarchyId,
              },
            },
          },
        ],
        edges: addEdge(
          {
            id: createEdgeId(parentNodeId, temporaryNodeId),
            source: parentNodeId,
            target: temporaryNodeId,
            type: 'smoothstep',
            data: { type: 'hierarchy' },
            animated: true,
          },
          state.edges,
        ),
      }));

      try {
        await createHierarchyNode({
          title: preparedTitle,
          type: 'department',
          parent_id: parentHierarchyId,
        });
        await get().loadGraph();
      } catch (err) {
        set({ error: getApiErrorMessage(err, 'Не удалось создать департамент') });
        await get().loadGraph();
      }
      return;
    }

    if (parentNode.type === 'company') {
      set({
        error: 'Обычного пользователя нельзя создавать в корневом узле. Используйте "Назначить нового CEO" или выберите департамент.',
      });
      return;
    }

    const matchedUser = userId ? dbUsers.find((user) => user.id === userId) || null : resolveUserByTitle(dbUsers, preparedTitle);
    if (!matchedUser?.id) {
      set({
        error: 'Пользователь не найден в базе. Выберите пользователя из списка.',
      });
      return;
    }

    const temporaryNodeId = `tmp:user:${Date.now()}`;

    set((state) => ({
      nodes: [
        ...state.nodes,
        {
          id: temporaryNodeId,
          type: 'user',
          draggable: true,
          position: nextPosition(parentNode),
          data: {
            title: matchedUser.full_name?.trim() || matchedUser.email,
            userId: matchedUser.id,
            role: roleTitle?.trim() || undefined,
            subtitle: roleTitle?.trim() || 'Участник',
            parentId: parentNodeId,
            meta: {
              parentHierarchyId,
              userId: matchedUser.id,
              email: matchedUser.email,
              avatarUrl: avatarUrl || matchedUser.avatar_url || null,
              roleTitle: roleTitle || null,
            },
          },
        },
      ],
      edges: addEdge(
        {
          id: createEdgeId(parentNodeId, temporaryNodeId),
          source: parentNodeId,
          target: temporaryNodeId,
          type: 'smoothstep',
          data: { type: 'hierarchy' },
          animated: true,
        },
        state.edges,
      ),
    }));

    try {
      const assignedNode = await assignUserToHierarchy({
        node_id: parentHierarchyId,
        user_id: matchedUser.id,
      });

      if (assignedNode?.id && roleTitle?.trim()) {
        await updateHierarchyNode(assignedNode.id, { role_title: roleTitle.trim() });
      }

      await get().loadGraph();
    } catch (err) {
      set({ error: getApiErrorMessage(err, 'Не удалось назначить пользователя') });
      await get().loadGraph();
    }
  },

  assignRole: async (nodeId, roleTitle) => {
    if (!get().canEdit) return;

    const node = get().nodes.find((item) => item.id === nodeId);
    if (!node) return;

    const prepared = roleTitle.trim();
    if (!prepared) return;

    if (node.type !== 'user') return;

    const hierarchyNodeId = node.data.meta.sourceHierarchyId || node.id;
    await updateHierarchyNode(hierarchyNodeId, { role_title: prepared });
    await get().loadGraph();
  },

  createDepartment: async (parentNodeId, title) => {
    if (!get().canEdit) return;

    await get().createNode({
      parentNodeId,
      type: 'department',
      title,
    });
  },

  assignCEO: async (companyNodeId, userId) => {
    if (!get().canEdit) return;

    const companyNode = get().nodes.find((node) => node.id === companyNodeId && node.type === 'company');
    const companyHierarchyId = toHierarchyTargetId(companyNode);
    if (!companyHierarchyId || !userId) return;

    await assignUserToHierarchy({
      node_id: companyHierarchyId,
      user_id: userId,
    });

    await get().loadGraph();
  },

  renameNode: async (nodeId, title) => {
    if (!get().canEdit) return;

    const node = get().nodes.find((item) => item.id === nodeId);
    if (!node) return;

    const preparedTitle = title.trim();

    if (node.type === 'company') return;

    const hierarchyNodeId = node.data.meta.sourceHierarchyId || node.id;
    await updateHierarchyNode(hierarchyNodeId, { title: preparedTitle });
    await get().loadGraph();
  },

  deleteNode: async (nodeId) => {
    if (!get().canEdit) return;

    const node = get().nodes.find((item) => item.id === nodeId);
    if (!node) return;

    if (node.type === 'company') return;

    const hierarchyNodeId = node.data.meta.sourceHierarchyId || node.id;
    await deleteHierarchyNode(hierarchyNodeId);
    await get().loadGraph();
  },

  setUserStatus: async (nodeId, status) => {
    if (!get().canEdit) return;

    const node = get().nodes.find((item) => item.id === nodeId);
    if (!node) return;

    const hierarchyNodeId = node.data.meta.sourceHierarchyId || node.id;
    await updateNodeStatus(hierarchyNodeId, status);
    await get().loadGraph();
  },

  moveUserNodeToTarget: async (userNodeId, targetNodeId) => {
    if (!get().canEdit) return;

    const { nodes, currentUserId } = get();
    const userNode = nodes.find((node) => node.id === userNodeId);
    const targetNode = nodes.find((node) => node.id === targetNodeId);
    const companyNode = nodes.find((node) => node.type === 'company');

    if (!userNode || !targetNode || userNode.type !== 'user') return;

    const userId = userNode.data.meta.userId;
    const targetHierarchyId = toHierarchyTargetId(targetNode);
    const rootCEOUserId = companyNode?.data.meta.userId || null;
    const movingSelf = Boolean(currentUserId && userId === currentUserId);

    if (userNode.data.meta.isCEO || (rootCEOUserId && userId === rootCEOUserId)) {
      set({
        error: 'Нельзя переносить действующего CEO в департамент. Сначала назначьте другого CEO.',
      });
      return;
    }

    if (!userId || !targetHierarchyId) return;

    try {
      const assignedNode = await assignUserToHierarchy({
        node_id: targetHierarchyId,
        user_id: userId,
      });

      const roleTitle =
        userNode.data.role?.trim() ||
        userNode.data.meta.roleTitle?.trim() ||
        userNode.data.subtitle?.trim() ||
        '';

      // If user moves self and loses manage permissions after reassignment,
      // avoid failing on follow-up role patch and just refresh graph state.
      if (!movingSelf && assignedNode?.id && roleTitle) {
        await updateHierarchyNode(assignedNode.id, { role_title: roleTitle });
      }
    } catch (err) {
      if (getApiStatus(err) === 403) {
        set({ error: 'Недостаточно прав для этого перемещения. Назначьте CEO/HR или попросите администратора.' });
      } else {
        set({ error: getApiErrorMessage(err, 'Не удалось переместить пользователя') });
      }
    } finally {
      await get().loadGraph();
    }
  },

  relayout: (direction = get().direction) => {
    const { nodes, edges } = get();
    const layouted = applyDagreLayout(nodes, edges, direction);

    set({
      nodes: layouted.nodes,
      edges: layouted.edges,
      direction,
    });
  },
}));
