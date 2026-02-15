export type EditorBlockType = 'text' | 'image' | 'video' | 'file' | 'subtask' | 'page';

export type EditorBlock = {
  id: string;
  type: EditorBlockType;
  content: string;
  pageId?: string;
  isCompleted?: boolean;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  childBlocks?: EditorBlock[];
};

type TaskMetaPayload = {
  assignees?: string[];
};

const TASK_META_BLOCK_ID = '__task_meta__';

function normalizeAssignees(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

export function unpackTaskBlocks(raw: unknown): { blocks: EditorBlock[]; assignees: string[] } {
  const parsed = Array.isArray(raw) ? (raw as EditorBlock[]) : [];

  const metaBlock = parsed.find((block) => block?.id === TASK_META_BLOCK_ID);
  let assignees: string[] = [];

  if (metaBlock?.content) {
    try {
      const payload = JSON.parse(metaBlock.content) as TaskMetaPayload;
      assignees = normalizeAssignees(payload.assignees);
    } catch {
      assignees = [];
    }
  }

  const blocks = parsed.filter((block) => block?.id !== TASK_META_BLOCK_ID);
  return { blocks, assignees };
}

export function packTaskBlocks(blocks: EditorBlock[], assignees: string[]): EditorBlock[] {
  const visibleBlocks = (Array.isArray(blocks) ? blocks : []).filter((block) => block?.id !== TASK_META_BLOCK_ID);
  const metaPayload: TaskMetaPayload = { assignees: normalizeAssignees(assignees) };

  return [
    {
      id: TASK_META_BLOCK_ID,
      type: 'text',
      content: JSON.stringify(metaPayload),
    },
    ...visibleBlocks,
  ];
}
