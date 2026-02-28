'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Background,
  Controls,
  ReactFlow,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';

import { CompanyNode } from '@/components/hierarchy-graph/nodes/CompanyNode';
import { DepartmentNode } from '@/components/hierarchy-graph/nodes/DepartmentNode';
import { GhostNode } from '@/components/hierarchy-graph/nodes/GhostNode';
import { UserNode } from '@/components/hierarchy-graph/nodes/UserNode';
import type { HierarchyGraphEdge, HierarchyGraphNode } from '@/lib/hierarchy-graph';
import { useHierarchyGraphStore } from '@/store/useHierarchyGraphStore';

const nodeTypes: NodeTypes = {
  company: CompanyNode,
  department: DepartmentNode,
  user: UserNode,
  ghost: GhostNode,
};

type HierarchyGraphCanvasProps = {
  onUserNodePick?: (payload: { userId: string; title: string }) => void;
};

export function HierarchyGraphCanvas({ onUserNodePick }: HierarchyGraphCanvasProps) {
  const [rf, setRf] = useState<ReactFlowInstance<HierarchyGraphNode, HierarchyGraphEdge> | null>(null);
  const moveInFlightRef = useRef(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const nodes = useHierarchyGraphStore((state) => state.nodes);
  const edges = useHierarchyGraphStore((state) => state.edges);
  const canEdit = useHierarchyGraphStore((state) => state.canEdit);
  const draftCreation = useHierarchyGraphStore((state) => state.draftCreation);
  const onNodesChange = useHierarchyGraphStore((state) => state.onNodesChange);
  const onEdgesChange = useHierarchyGraphStore((state) => state.onEdgesChange);
  const onConnect = useHierarchyGraphStore((state) => state.onConnect);
  const moveUserNodeToTarget = useHierarchyGraphStore((state) => state.moveUserNodeToTarget);
  const setSelectedNode = useHierarchyGraphStore((state) => state.setSelectedNode);

  const fitViewOptions = useMemo(() => ({ padding: 0.2, duration: 600 }), []);

  const previewNode = useMemo<HierarchyGraphNode | null>(() => {
    if (!draftCreation?.parentNodeId) return null;

    const parentNode = nodes.find((item) => item.id === draftCreation.parentNodeId);
    if (!parentNode) return null;

    const seed = parentNode.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomOffset = ((seed % 7) - 3) * 28;

    return {
      id: '__ghost_preview__',
      type: 'ghost',
      draggable: false,
      selectable: false,
      position: {
        x: parentNode.position.x + 260,
        y: parentNode.position.y + randomOffset,
      },
      data: {
        title: draftCreation.title,
        parentId: parentNode.id,
        meta: {
          isGhost: true,
          parentHierarchyId: parentNode.id,
        },
      },
    };
  }, [draftCreation, nodes]);

  const graphNodes = useMemo(
    () => (previewNode ? [...nodes, previewNode] : nodes),
    [nodes, previewNode],
  );

  const graphEdges = useMemo<HierarchyGraphEdge[]>(() => {
    if (!previewNode || !draftCreation?.parentNodeId) return edges;

    return [
      ...edges,
      {
        id: '__ghost_edge__',
        source: draftCreation.parentNodeId,
        target: previewNode.id,
        type: 'smoothstep',
        animated: true,
        data: { type: 'hierarchy' },
        style: { strokeDasharray: '4 4', strokeOpacity: 0.8 },
      },
    ];
  }, [draftCreation?.parentNodeId, edges, previewNode]);

  const handleNodeDragStop = useCallback(
    async (_: unknown, node: HierarchyGraphNode) => {
      if (!rf || node.type !== 'user') return;
      if (moveInFlightRef.current) return;

      const targets = rf
        .getIntersectingNodes(node)
        .filter((item) => item.id !== node.id && ['company', 'department'].includes(String(item.type)));

      const target = targets.at(-1);
      if (!target) return;

      if (node?.data?.meta?.parentHierarchyId && node.data.meta.parentHierarchyId === target.id) {
        return;
      }

      moveInFlightRef.current = true;
      try {
        await moveUserNodeToTarget(node.id, target.id);
      } finally {
        moveInFlightRef.current = false;
      }
    },
    [rf, moveUserNodeToTarget],
  );

  const handleNodeClick = useCallback(
    (_: unknown, node: HierarchyGraphNode) => {
      setSelectedNode(node.id);

      if (!onUserNodePick || String(node.type || '') !== 'user') {
        return;
      }

      const rawUserId = node.data.userId || node.data.meta.userId || '';
      const userId = String(rawUserId || '').trim();
      if (!userId) {
        return;
      }

      onUserNodePick({
        userId,
        title: String(node.data.title || '').trim() || 'Сотрудник',
      });
    },
    [onUserNodePick, setSelectedNode],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow<HierarchyGraphNode, HierarchyGraphEdge>
        nodes={graphNodes}
        edges={graphEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={() => setSelectedNode(null)}
        onNodeDragStop={handleNodeDragStop}
        onInit={setRf}
        fitView
        fitViewOptions={fitViewOptions}
        panOnScroll
        zoomOnPinch
        zoomOnScroll
        panOnDrag
        minZoom={0.2}
        maxZoom={1.8}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        className="bg-slate-50 dark:bg-slate-950"
      >
        <Controls showInteractive={false} />
        <Background
          gap={22}
          size={1}
          color={isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.35)'}
        />
      </ReactFlow>
    </div>
  );
}
