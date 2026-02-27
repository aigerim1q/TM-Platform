'use client';

import { Building2, Crown } from 'lucide-react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { InteractiveNode } from '@/components/hierarchy-graph/InteractiveNode';
import type { HierarchyGraphNode } from '@/lib/hierarchy-graph';
import { getFileUrl } from '@/lib/utils';

export function CompanyNode({ id, type, data, selected }: NodeProps<HierarchyGraphNode>) {
  const avatar = getFileUrl(data.meta.avatarUrl) || data.meta.avatarUrl || '';

  return (
    <InteractiveNode id={id} type={type || 'company'} selected={selected} canDelete={false}>
      <div
        className={`w-80 rounded-2xl border bg-white/95 p-4 text-slate-900 shadow-2xl transition-all dark:bg-slate-900/90 dark:text-white ${
          selected
            ? 'border-indigo-400 ring-2 ring-indigo-300/50'
            : 'border-slate-200 dark:border-white/15'
        }`}
      >
        <Handle type="target" position={Position.Top} className="h-2.5 w-2.5 bg-indigo-300" />
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={data.title} className="h-full w-full object-cover" />
            ) : (
              <Building2 size={18} />
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-indigo-500/90 dark:text-indigo-200/80">Company</p>
            <h3 className="text-base font-semibold leading-tight">{data.title}</h3>
            {data.subtitle && <p className="text-xs text-slate-500 dark:text-slate-300">{data.subtitle}</p>}
          </div>
        </div>
        {(Boolean(data.meta.userId) || data.meta.isCEO) && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
            <Crown size={12} />
            CEO
          </div>
        )}
        <Handle type="source" position={Position.Bottom} className="h-2.5 w-2.5 bg-indigo-300" />
      </div>
    </InteractiveNode>
  );
}
