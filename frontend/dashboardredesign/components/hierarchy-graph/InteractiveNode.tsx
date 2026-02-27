'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Crown, Plus, Trash2, UserRoundCog } from 'lucide-react';

import { FloatingActionMenu } from '@/components/hierarchy-graph/FloatingActionMenu';
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useHierarchyGraphStore } from '@/store/useHierarchyGraphStore';

type InteractiveNodeProps = {
  id: string;
  type: string;
  selected: boolean;
  canDelete?: boolean;
  children: React.ReactNode;
};

export function InteractiveNode({ id, type, selected, canDelete = true, children }: InteractiveNodeProps) {
  const canEdit = useHierarchyGraphStore((state) => state.canEdit);
  const deleteNode = useHierarchyGraphStore((state) => state.deleteNode);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<'default' | 'role' | 'status' | 'ceo'>('default');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const openMenu = (mode: 'default' | 'role' | 'status' | 'ceo') => {
    setMenuMode(mode);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setMenuMode('default');
  };

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(target)) {
        closeMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!selected && menuOpen) {
      closeMenu();
    }
  }, [menuOpen, selected]);

  const requestDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    await deleteNode(id);
    setDeleteDialogOpen(false);
    closeMenu();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="group relative"
          onDoubleClick={() => {
            if (!canEdit) return;
            openMenu(type === 'user' ? 'status' : type === 'company' ? 'ceo' : 'default');
          }}
        >
          {children}

          {canEdit && selected && (
            <>
              <button
                className="nodrag nopan absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-slate-300 bg-indigo-500 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:border-white/25"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (menuOpen) {
                    closeMenu();
                    return;
                  }
                  openMenu('default');
                }}
                aria-label="Open quick actions"
              >
                <Plus size={13} />
              </button>

              {canDelete && (
                <button
                  className="nodrag nopan absolute -right-2 top-6 grid h-6 w-6 place-items-center rounded-full border border-slate-300 bg-rose-500 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:border-white/25"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    requestDelete();
                  }}
                  aria-label="Удалить узел"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </>
          )}

          {canEdit && menuOpen && (
            <FloatingActionMenu
              nodeId={id}
              nodeType={type}
              initialMode={menuMode}
              onClose={() => {
                closeMenu();
              }}
            />
          )}
        </motion.div>
      </ContextMenuTrigger>

      {canEdit && (
        <ContextMenuContent className="w-44">
          {type === 'user' ? (
            <ContextMenuItem
              onClick={() => {
                openMenu('status');
              }}
            >
              <Activity className="h-3.5 w-3.5" />
              Изменить статус
            </ContextMenuItem>
          ) : type === 'company' ? (
            <ContextMenuItem
              onClick={() => {
                openMenu('ceo');
              }}
            >
              <Crown className="h-3.5 w-3.5" />
              Назначить нового CEO
            </ContextMenuItem>
          ) : null}
          {type === 'user' && (
            <ContextMenuItem
              onClick={() => {
                openMenu('role');
              }}
            >
              <UserRoundCog className="h-3.5 w-3.5" />
              Assign Role
            </ContextMenuItem>
          )}
          {canDelete && (
            <ContextMenuItem
              variant="destructive"
              onClick={() => {
                requestDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      )}

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить узел?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Узел и его дочерние элементы будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
              onClick={() => {
                void handleDeleteConfirm();
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextMenu>
  );
}
