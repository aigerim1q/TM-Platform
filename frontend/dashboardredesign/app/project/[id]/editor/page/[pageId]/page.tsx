'use client';

import { useParams } from 'next/navigation';
import NewProjectPage from '@/app/projects/new/page';

export default function ProjectEditorPageRoute() {
  const params = useParams();
  const projectId = String(params.id || '');
  const pageId = String(params.pageId || '');

  return <NewProjectPage existingProjectId={projectId} existingPageId={pageId} forcedMode="page" />;
}
