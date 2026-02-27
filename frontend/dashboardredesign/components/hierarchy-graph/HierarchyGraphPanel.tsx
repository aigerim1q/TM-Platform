'use client';

import { useMemo, useState } from 'react';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHierarchyGraphStore } from '@/store/useHierarchyGraphStore';

export function HierarchyGraphPanel() {
  const nodes = useHierarchyGraphStore((state) => state.nodes);
  const loading = useHierarchyGraphStore((state) => state.loading);
  const error = useHierarchyGraphStore((state) => state.error);
  const canEdit = useHierarchyGraphStore((state) => state.canEdit);
  const selectedNodeId = useHierarchyGraphStore((state) => state.selectedNodeId);
  const relayout = useHierarchyGraphStore((state) => state.relayout);
  const createDepartment = useHierarchyGraphStore((state) => state.createDepartment);
  const deleteNode = useHierarchyGraphStore((state) => state.deleteNode);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [departmentTitle, setDepartmentTitle] = useState('');

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  const parentOptions = useMemo(
    () => nodes.filter((node) => node.type === 'company' || node.type === 'department'),
    [nodes],
  );

  const [selectedParentNodeId, setSelectedParentNodeId] = useState<string>('');

  const openCreateModal = () => {
    setSelectedParentNodeId(selectedNode?.id || parentOptions[0]?.id || '');
    setDepartmentTitle('');
    setIsCreateOpen(true);
  };

  const handleCreateDepartment = async () => {
    if (!selectedParentNodeId || !departmentTitle.trim()) return;
    await createDepartment(selectedParentNodeId, departmentTitle);
    setIsCreateOpen(false);
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    await deleteNode(selectedNode.id);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => relayout('TB')} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Auto-layout
        </Button>

        {canEdit && (
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Add department node
          </Button>
        )}

        {canEdit && selectedNode && selectedNode.type !== 'company' && (
          <>
            <Button variant="destructive" onClick={() => void handleDeleteNode()}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!canEdit && <p className="mb-4 text-xs text-slate-500">Read-only mode. You can navigate the graph but cannot edit nodes.</p>}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create department node</DialogTitle>
            <DialogDescription>Choose a parent node and create a new department node.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Parent node</Label>
              <select
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={selectedParentNodeId}
                onChange={(e) => setSelectedParentNodeId(e.target.value)}
              >
                {parentOptions.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.data.title} ({node.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Department title</Label>
              <Input
                value={departmentTitle}
                onChange={(e) => setDepartmentTitle(e.target.value)}
                placeholder="E.g. Finance Department"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateDepartment()} disabled={!selectedParentNodeId || !departmentTitle.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
