import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import { Position } from '@xyflow/react';
import type { HierarchyTreeNode } from '@/lib/users';

export type HierarchyGraphNodeType = 'company' | 'department' | 'user' | 'ghost';

export type HierarchyGraphNodeData = {
  title: string;
  userId?: string;
  role?: string;
  subtitle?: string;
  parentId?: string | null;
  meta: {
    sourceHierarchyId?: string;
    parentHierarchyId?: string | null;
    userId?: string | null;
    roleTitle?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    status?: string | null;
    linkedUserNodeId?: string | null;
    isCEO?: boolean;
    isGhost?: boolean;
  };
};

export type HierarchyGraphEdgeData = {
  type: 'hierarchy';
};

export type HierarchyGraphNode = Node<HierarchyGraphNodeData, HierarchyGraphNodeType>;
export type HierarchyGraphEdge = Edge<HierarchyGraphEdgeData>;

function sizeByType(type: HierarchyGraphNodeType): { width: number; height: number } {
  if (type === 'company') return { width: 320, height: 124 };
  if (type === 'department') return { width: 300, height: 116 };
  if (type === 'ghost') return { width: 260, height: 92 };
  return { width: 280, height: 108 };
}

function buildEdge(source: string, target: string): HierarchyGraphEdge {
  return {
    id: `edge:${source}->${target}`,
    source,
    target,
    type: 'smoothstep',
    data: { type: 'hierarchy' },
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  };
}

function personTitle(node: HierarchyTreeNode): string {
  return node.user?.full_name?.trim() || node.user?.email || node.title || 'Сотрудник';
}

function personSubtitle(node: HierarchyTreeNode): string {
  const role = node.role_title?.trim();
  if (role) return role;
  return 'Участник';
}

function isCEORole(roleTitle?: string | null): boolean {
  const normalized = String(roleTitle || '').trim().toLowerCase();
  return normalized === 'генеральный директор' || normalized === 'ceo';
}

export function buildGraphFromTree(tree: HierarchyTreeNode[]): {
  nodes: HierarchyGraphNode[];
  edges: HierarchyGraphEdge[];
} {
  const nodes: HierarchyGraphNode[] = [];
  const edges: HierarchyGraphEdge[] = [];

  const walk = (item: HierarchyTreeNode, parentGraphNodeId: string | null) => {
    if (item.type === 'user') {
      const userNodeId = item.id;
      const roleTitle = item.role_title?.trim() || null;

      const userNode: HierarchyGraphNode = {
        id: userNodeId,
        type: 'user',
        draggable: true,
        position: { x: 0, y: 0 },
        data: {
          title: personTitle(item),
          userId: item.user_id || undefined,
          role: roleTitle || undefined,
          subtitle: personSubtitle(item),
          parentId: item.parent_id || null,
          meta: {
            sourceHierarchyId: item.id,
            parentHierarchyId: item.parent_id || null,
            userId: item.user_id || null,
            roleTitle,
            email: item.user?.email || null,
            avatarUrl: item.user?.avatar_url || null,
            status: item.status || null,
            isCEO: isCEORole(roleTitle),
          },
        },
      };

      nodes.push(userNode);

      if (parentGraphNodeId) {
        edges.push(buildEdge(parentGraphNodeId, userNodeId));
      }

      return;
    }

    if (item.type === 'role') {
      if (item.children?.length) {
        item.children.forEach((child) => walk(child, parentGraphNodeId));
      }
      return;
    }

    const graphNodeId = item.id;
    const type = (item.type || 'department') as HierarchyGraphNodeType;

    const companyAssignedName =
      type === 'company'
        ? item.user?.full_name?.trim() || item.user?.email || item.title || 'Компания'
        : null;

    nodes.push({
      id: graphNodeId,
      type,
      draggable: true,
      position: { x: 0, y: 0 },
      data: {
        title:
          type === 'company'
            ? companyAssignedName || 'Компания'
            : item.title || 'Без названия',
        subtitle:
          type === 'company'
            ? item.user_id
              ? 'Генеральный директор'
              : 'Корневой узел'
            : type === 'department'
              ? 'Департамент'
              : 'Узел',
        parentId: item.parent_id || null,
        meta: {
          sourceHierarchyId: item.id,
          parentHierarchyId: item.parent_id || null,
          userId: item.user_id || null,
          roleTitle: item.role_title || null,
          email: item.user?.email || null,
          avatarUrl: item.user?.avatar_url || null,
          status: item.status || null,
        },
      },
    });

    if (parentGraphNodeId) {
      edges.push(buildEdge(parentGraphNodeId, graphNodeId));
    }

    if (item.children?.length) {
      item.children.forEach((child) => walk(child, graphNodeId));
    }
  };

  tree.forEach((root) => walk(root, null));

  const ceoNode = nodes.find((node) => node.type === 'user' && Boolean(node.data.meta.isCEO));
  if (ceoNode) {
    const companyNode = nodes.find((node) => node.type === 'company');
    if (companyNode && !companyNode.data.meta.userId) {
      companyNode.data = {
        ...companyNode.data,
        title: ceoNode.data.title,
        meta: {
          ...companyNode.data.meta,
          avatarUrl: ceoNode.data.meta.avatarUrl || null,
        },
      };
    }
  }

  const uniqueEdges = Array.from(new Map(edges.map((e) => [e.id, e])).values());
  return { nodes, edges: uniqueEdges };
}

export function applyDagreLayout(
  rawNodes: HierarchyGraphNode[],
  rawEdges: HierarchyGraphEdge[],
  direction: 'TB' | 'LR' = 'TB',
): { nodes: HierarchyGraphNode[]; edges: HierarchyGraphEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 84, nodesep: 44, marginx: 24, marginy: 24 });

  rawNodes.forEach((node) => {
    const { width, height } = sizeByType(node.type as HierarchyGraphNodeType);
    g.setNode(node.id, { width, height });
  });

  rawEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const nodes = rawNodes.map((node) => {
    const layouted = g.node(node.id);
    const { width, height } = sizeByType(node.type as HierarchyGraphNodeType);

    return {
      ...node,
      position: {
        x: layouted.x - width / 2,
        y: layouted.y - height / 2,
      },
      sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
      targetPosition: direction === 'TB' ? Position.Top : Position.Left,
    };
  });

  return { nodes, edges: rawEdges };
}

export const EXAMPLE_GRAPH: { nodes: HierarchyGraphNode[]; edges: HierarchyGraphEdge[] } = {
  nodes: [
    {
      id: 'company:1',
      type: 'company',
      position: { x: 0, y: 0 },
      data: { title: 'Qurylys Group', subtitle: 'Корневой узел', meta: { sourceHierarchyId: 'company:1' } },
    },
    {
      id: 'department:eng',
      type: 'department',
      position: { x: 0, y: 180 },
      data: { title: 'Engineering', subtitle: 'Департамент', parentId: 'company:1', meta: { sourceHierarchyId: 'department:eng' } },
    },
    {
      id: 'user:u1',
      type: 'user',
      position: { x: 0, y: 320 },
      data: {
        title: 'Aruzhan Ospanova',
        subtitle: 'Lead Engineer',
        role: 'Lead Engineer',
        userId: 'u1',
        parentId: 'department:eng',
        meta: { userId: 'u1', sourceHierarchyId: 'user:u1' },
      },
    },
  ],
  edges: [
    buildEdge('company:1', 'department:eng'),
    buildEdge('department:eng', 'user:u1'),
  ],
};
