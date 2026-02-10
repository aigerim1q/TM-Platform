import { api } from "./api";

export type UserPublic = {
  id: string;
  email: string;
  role: string;
  manager_id?: string | null;
  created_at: string;
};

export type HierarchyNode = {
  id: string;
  email: string;
  role?: string;
  manager_id?: string | null;
  subordinates?: HierarchyNode[];
};

export async function getUserProfile(id: string) {
  const { data } = await api.get<UserPublic>(`/users/${id}`);
  return data;
}

export async function getUserManager(id: string) {
  const { data } = await api.get<UserPublic | null>(`/users/${id}/manager`);
  return data;
}

export async function getUserSubordinates(id: string) {
  const { data } = await api.get<UserPublic[]>(`/users/${id}/subordinates`);
  return data;
}

export async function getHierarchy() {
  const { data } = await api.get<HierarchyNode | HierarchyNode[]>("/hierarchy");
  return data;
}
