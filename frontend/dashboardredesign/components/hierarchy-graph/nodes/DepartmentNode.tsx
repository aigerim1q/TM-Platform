'use client';

import { FolderTree } from 'lucide-react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { InteractiveNode } from '@/components/hierarchy-graph/InteractiveNode';
import type { HierarchyGraphNode } from '@/lib/hierarchy-graph';

export function DepartmentNode({ id, type, data, selected }: NodeProps<HierarchyGraphNode>) {
  return (
    <InteractiveNode id={id} type={type || 'department'} selected={selected}>
      <div
        className={`w-72 rounded-2xl border bg-white/95 p-4 shadow-xl backdrop-blur dark:bg-slate-900/90 ${
          selected ? 'border-violet-400 ring-2 ring-violet-300/40' : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <Handle type="target" position={Position.Top} className="h-2.5 w-2.5 bg-violet-500" />
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
            <FolderTree size={18} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Department</p>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{data.title}</h3>
            {data.subtitle && <p className="text-xs text-slate-500 dark:text-slate-300">{data.subtitle}</p>}
          </div>
        </div>
        {data.meta.isCEO && (
          <p className="mt-2 text-[11px] uppercase tracking-wide text-amber-500 dark:text-amber-300">CEO</p>
        )}
        <Handle type="source" position={Position.Bottom} className="h-2.5 w-2.5 bg-violet-500" />
      </div>
    </InteractiveNode>
  );
}
