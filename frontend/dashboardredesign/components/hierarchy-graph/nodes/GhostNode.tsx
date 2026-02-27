'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import type { HierarchyGraphNode } from '@/lib/hierarchy-graph';

export function GhostNode({ data }: NodeProps<HierarchyGraphNode>) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-64 rounded-xl border border-indigo-300/40 bg-indigo-500/10 p-3 text-indigo-100 shadow-lg"
    >
      <Handle type="target" position={Position.Top} className="h-2 w-2 bg-indigo-300" />
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-indigo-300" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-indigo-200/80">Preview</p>
          <p className="text-sm font-medium">{data.title || 'Typing…'}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="h-2 w-2 bg-indigo-300" />
    </motion.div>
  );
}
