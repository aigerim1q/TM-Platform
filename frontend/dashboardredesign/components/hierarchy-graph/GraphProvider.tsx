'use client';

import { useEffect } from 'react';
import { useHierarchyGraphStore } from '@/store/useHierarchyGraphStore';

type Props = {
  children: React.ReactNode;
};

export function GraphProvider({ children }: Props) {
  const loadGraph = useHierarchyGraphStore((state) => state.loadGraph);
  const hasGraphData = useHierarchyGraphStore((state) => state.nodes.length > 0 || state.edges.length > 0);

  useEffect(() => {
    void loadGraph(hasGraphData);
  }, [hasGraphData, loadGraph]);

  return <>{children}</>;
}
