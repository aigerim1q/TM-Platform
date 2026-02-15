'use client';

import { useEffect, useState } from 'react';

import Header from '@/components/header';
import { getHierarchy, type HierarchyNode } from '@/lib/users';
import { cn, getDisplayNameFromEmail } from '@/lib/utils';

type StatusType = 'free' | 'busy' | 'sick';

interface Person {
  title: string;
  name: string;
  status: StatusType;
  note?: string;
  children?: Person[];
  isDept?: boolean;
  isCeo?: boolean;
}

const MAX_DEPTH = 6;

function mapHierarchyNode(node: HierarchyNode, depth: number): Person {
  const hasMore = Array.isArray(node.subordinates) && node.subordinates.length > 0;
  const children = depth >= MAX_DEPTH
    ? []
    : (node.subordinates || []).map((child) => mapHierarchyNode(child, depth + 1));

  return {
    title: node.role || 'Сотрудник',
    name: getDisplayNameFromEmail(node.email),
    status: 'free',
    note: depth >= MAX_DEPTH && hasMore ? 'Глубина ограничена' : undefined,
    children,
  };
}

function StatusBadge({ status }: { status: StatusType }) {
  const statusConfig = {
    free: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Свободен' },
    busy: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Занят' },
    sick: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Болен' },
  };

  const config = statusConfig[status];

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs', config.bg, config.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}

function PersonCard({ person }: { person: Person }) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-xl p-3 border dark:border-gray-700 min-w-[210px] max-w-[260px] mx-auto shadow-sm text-left',
        person.isDept && 'bg-gray-50 dark:bg-gray-900'
      )}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-300 font-bold flex-shrink-0">
          ?
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
            {person.title}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{person.name}</div>
          <StatusBadge status={person.status} />
        </div>
      </div>

      {person.note && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{person.note}</p>
      )}

      {/* ✅ КНОПКА ВЫБРАТЬ */}
      <button
        className="mt-3 w-full rounded-lg bg-[#cdbb9a] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        disabled={person.status === 'busy'}
      >
        Выбрать
      </button>
    </div>
  );
}


function OrgNode({ person, depth = 0 }: { person: Person; depth?: number }) {
  const hasChildren = person.children && person.children.length > 0;
  const canRenderChildren = hasChildren && depth < MAX_DEPTH;

  return (
    <li className="relative text-center pt-5 px-2">
      <PersonCard person={person} />
      {canRenderChildren && (
        <ul className="flex justify-center pt-7 relative before:content-[''] before:absolute before:top-0 before:left-1/2 before:border-l before:border-gray-300 before:h-6">
          {person.children!.map((child, index) => (
            <OrgNode key={index} person={child} depth={depth + 1} />
          ))}
        </ul>
      )}
      {hasChildren && !canRenderChildren && (
        <div className="mt-2 text-xs text-gray-500">Глубина ограничена</div>
      )}
    </li>
  );
}

export default function HierarchyPage() {
  const [orgTree, setOrgTree] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getHierarchy()
      .then((data) => {
        if (!isMounted) return;

        if (Array.isArray(data)) {
          setOrgTree({
            title: 'Компания',
            name: 'Организационная структура',
            status: 'free',
            isCeo: true,
            children: data.map((item) => mapHierarchyNode(item, 1)),
          });
        } else {
          setOrgTree(mapHierarchyNode(data, 0));
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Ошибка загрузки иерархии');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header - centered */}
      <Header />

      {/* Content */}
      <div className="px-6 py-8 pt-28">
        <h1 className="text-xl font-semibold text-center mb-2 text-gray-900 dark:text-white">Иерархия строительной компании</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">Организационная структура с отделами и сотрудниками</p>

        {loading && (
          <p className="text-center text-sm text-gray-500">Загрузка...</p>
        )}

        {error && !loading && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}

        {/* Org Chart */}
        {!loading && !error && orgTree && (
          <div className="overflow-x-auto pb-10">
            <div className="flex justify-center min-w-max">
              <ul className="flex justify-center org-chart">
                <OrgNode person={orgTree} />
              </ul>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .org-chart li::before,
        .org-chart li::after {
          content: "";
          position: absolute;
          top: 0;
          right: 50%;
          right: 50%;
          border-top: 1px solid #d1d5db; /* gray-300 */
          width: 50%;
          height: 20px;
        }
        :global(.dark) .org-chart li::before,
        :global(.dark) .org-chart li::after {
          border-color: #4b5563; /* gray-600 */
        }
        .org-chart li::after {
          right: auto;
          left: 50%;
          left: 50%;
          border-left: 1px solid #d1d5db;
        }
        .org-chart li:only-child::before,
        .org-chart li:only-child::after {
          display: none;
        }
        .org-chart li:only-child {
          padding-top: 0;
        }
        .org-chart li:first-child::before,
        .org-chart li:last-child::after {
          border: 0 none;
        }
        .org-chart li:last-child::before {
          border-right: 1px solid #d1d5db;
          border-radius: 0 5px 0 0;
        }
        .org-chart li:first-child::after {
          border-radius: 5px 0 0 0;
        }
      `}</style>
    </div>
  );
}
