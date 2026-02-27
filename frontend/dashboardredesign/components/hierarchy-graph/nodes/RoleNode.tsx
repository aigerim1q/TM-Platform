'use client';

import { BadgeCheck } from 'lucide-react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { InteractiveNode } from '@/components/hierarchy-graph/InteractiveNode';
import type { HierarchyGraphNode } from '@/lib/hierarchy-graph';

export function RoleNode({ id, type, data, selected }: NodeProps<HierarchyGraphNode>) {
  return (
    <InteractiveNode id={id} type={type || 'role'} selected={selected}>
      <div
        className={`w-60 rounded-xl border bg-amber-50/95 p-3 shadow-lg dark:bg-amber-900/30 ${
          selected ? 'border-amber-400 ring-2 ring-amber-300/40' : 'border-amber-200/70 dark:border-amber-700/50'
        }`}
      >
        <Handle type="target" position={Position.Top} className="h-2.5 w-2.5 bg-amber-500" />
        <div className="flex items-center gap-2.5">
          <BadgeCheck size={16} className="text-amber-600 dark:text-amber-300" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-amber-700/80 dark:text-amber-200/80">Role</p>
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">{data.title}</h4>
          </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="h-2.5 w-2.5 bg-amber-500" />
      </div>
    </InteractiveNode>
  );
}
