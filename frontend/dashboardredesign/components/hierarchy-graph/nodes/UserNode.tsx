'use client';

import { Crown, User2 } from 'lucide-react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { InteractiveNode } from '@/components/hierarchy-graph/InteractiveNode';
import type { HierarchyGraphNode } from '@/lib/hierarchy-graph';
import { getFileUrl } from '@/lib/utils';

function normalizeStatus(raw?: string | null): 'free' | 'busy' | 'sick' | null {
  const status = String(raw || '').trim().toLowerCase();

  if (status === 'free' || status === 'свободен' || status === 'available') return 'free';
  if (status === 'busy' || status === 'занят' || status === 'assigned') return 'busy';
  if (status === 'sick' || status === 'болен' || status === 'больничный') return 'sick';

  return null;
}

function getStatusLabel(raw?: string | null): string {
  const normalized = normalizeStatus(raw);

  if (normalized === 'free') return 'Свободен';
  if (normalized === 'busy') return 'Занят';
  if (normalized === 'sick') return 'Болен';

  return String(raw || '');
}

export function UserNode({ id, type, data, selected }: NodeProps<HierarchyGraphNode>) {
  const avatar = getFileUrl(data.meta.avatarUrl) || data.meta.avatarUrl || '';

  return (
    <InteractiveNode id={id} type={type || 'user'} selected={selected}>
      <div
        className={`w-72 rounded-2xl border bg-white p-3 shadow-lg dark:bg-slate-900 ${
          selected ? 'border-emerald-400 ring-2 ring-emerald-300/40' : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <Handle type="target" position={Position.Top} className="h-2.5 w-2.5 bg-emerald-500" />
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={data.title} className="h-full w-full object-cover" />
            ) : (
              <User2 size={18} />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{data.title}</h4>
            {(data.role || data.subtitle) && <p className="text-xs text-slate-500 dark:text-slate-300">{data.role || data.subtitle}</p>}
            {data.meta.status && (
              <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                {getStatusLabel(data.meta.status)}
              </p>
            )}
            {data.meta.isCEO && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                <Crown size={11} />
                CEO
              </div>
            )}
          </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="h-2.5 w-2.5 bg-emerald-500" />
      </div>
    </InteractiveNode>
  );
}
