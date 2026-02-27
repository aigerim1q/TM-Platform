export const PROJECTS_UPDATED_EVENT = 'projects-updated';

export function emitProjectsUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PROJECTS_UPDATED_EVENT));
}
