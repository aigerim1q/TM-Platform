'use client';

import { useParams } from 'next/navigation';
import NewProjectPage from '@/app/projects/new/page';

export default function ProjectEditorPage() {
  const params = useParams();
  const projectId = String(params.id || '');

  return <NewProjectPage existingProjectId={projectId} forcedMode="project" />;
}
