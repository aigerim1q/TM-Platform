'use client';

import { useParams } from 'next/navigation';
import NewProjectPage from '../../new/page';

export default function ProjectEditorPage() {
  const params = useParams();
  const projectId = params.id as string;

  return <NewProjectPage existingProjectId={projectId} forcedMode="project" />;
}
