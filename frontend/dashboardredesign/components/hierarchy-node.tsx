'use client';

import { getDisplayNameFromEmail, getFileUrl } from '@/lib/utils';
import type { HierarchyTreeNode } from '@/lib/users';

type Props = {
  node: HierarchyTreeNode;
  onNodeClick?: (node: HierarchyTreeNode) => void;
};

/* ── Status helpers ──────────────────────────────────────────────── */

type StatusVariant = 'free' | 'busy' | 'sick';

function resolveStatus(raw: string | undefined | null): StatusVariant {
  const s = (raw ?? '').toLowerCase().trim();
  if (s === 'busy' || s === 'занят' || s === 'assigned') return 'busy';
  if (s === 'sick' || s === 'болен' || s === 'больничный') return 'sick';
  return 'free';
}

const STATUS_LABEL: Record<StatusVariant, string> = {
  free: 'Свободен',
  busy: 'Занят',
  sick: 'Болен',
};

const STATUS_CSS: Record<StatusVariant, string> = {
  free: 'org-status-free',
  busy: 'org-status-busy',
  sick: 'org-status-sick',
};

/* ── Initials helper ─────────────────────────────────────────────── */

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0][0]?.toUpperCase() || '?';
}

/* ── Card titles ─────────────────────────────────────────────────── */

function getCardTitle(node: HierarchyTreeNode): string {
  if (node.type === 'company') return 'CEO';
  return node.title || '';
}

function getCardName(node: HierarchyTreeNode): string | null {
  if (node.type === 'company') {
    return node.user?.full_name?.trim() || getDisplayNameFromEmail(node.user?.email || null) || 'Не назначен';
  }
  if (node.type === 'user') {
    const person = node.user?.full_name?.trim() || getDisplayNameFromEmail(node.user?.email || null) || null;
    const title = (node.title || '').trim().toLowerCase();
    if (!person) return null;
    if (title && person.trim().toLowerCase() === title) return null;
    return person;
  }
  if (node.user) {
    const name = node.user.full_name?.trim() || getDisplayNameFromEmail(node.user.email || null);
    if (name) return `Руководитель: ${name}`;
  }
  return null;
}

/* ── OrgCard ─────────────────────────────────────────────────────── */

function OrgCard({ node, onNodeClick }: { node: HierarchyTreeNode; onNodeClick?: (n: HierarchyTreeNode) => void }) {
  const status = resolveStatus(node.status);
  const title = getCardTitle(node);
  const name = getCardName(node);

  const displayName = node.user?.full_name?.trim() || getDisplayNameFromEmail(node.user?.email || null) || '';
  const avatarUrl = getFileUrl(node.user?.avatar_url) || node.user?.avatar_url || '';
  const initials = getInitials(displayName);

  const isCompany = node.type === 'company';
  const isDept = node.type === 'department' || node.type === 'role';

  const cardClass = ['org-card', isCompany ? 'ceo' : '', isDept ? 'dept' : ''].filter(Boolean).join(' ');

  const roleLabel = node.role_title?.trim() || (isCompany ? 'Главный исполнительный директор' : null);

  return (
    <div className={cardClass} onClick={() => onNodeClick?.(node)} role="button" tabIndex={0}>
      <div className="org-avatar-wrapper">
        <div className="org-avatar">
          {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : initials}
        </div>
        <div className="org-person-main">
          <div className="org-title">{title}</div>
          {name && <div className="org-name">{name}</div>}
          {roleLabel && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{roleLabel}</div>
          )}
          <div className={`org-status ${STATUS_CSS[status]}`}>
            <span className="org-status-dot" />
            <span>{STATUS_LABEL[status]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Recursive HierarchyNode ─────────────────────────────────────── */

export function HierarchyNode({ node, onNodeClick }: Props) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  return (
    <li>
      <OrgCard node={node} onNodeClick={onNodeClick} />

      {hasChildren && (
        <ul>
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} onNodeClick={onNodeClick} />
          ))}
        </ul>
      )}
    </li>
  );
}
