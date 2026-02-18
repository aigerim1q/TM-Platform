import { api } from "./api";

export type UserPublic = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  email: string;
  role?: string | null;
  manager_id?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  created_at: string;
};

export type HierarchyNode = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  email: string;
  role?: string | null;
  manager_id?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  subordinates?: HierarchyNode[];
};

export type HierarchyTreeNode = {
  id: string;
  title: string;
  type: "company" | "department" | "role" | "user";
  parent_id?: string | null;
  user_id?: string | null;
  position: number;
  level: number;
  path: string;
  status: string;
  role_title?: string | null;
  user?: {
    id: string;
    email: string;
    full_name?: string | null;
    avatar_url?: string | null;
    role?: string | null;
    manager_id?: string | null;
  } | null;
  children: HierarchyTreeNode[];
};

export type HierarchyTreeResponse = {
  permissions: {
    can_edit: boolean;
    can_add_role: boolean;
    can_add_department: boolean;
    can_assign_user: boolean;
  };
  current_user_id?: string;
  catalogs?: {
    departments: HierarchyCatalogItem[];
    roles: HierarchyCatalogItem[];
  };
  tree: HierarchyTreeNode[];
};

export type HierarchyCatalogItem = {
  id: string;
  name: string;
  is_system: boolean;
};

export type Department = {
  id: string;
  name: string;
  parent_id?: string | null;
  created_at: string;
};

export async function getUserProfile(id: string) {
  const { data } = await api.get<UserPublic>(`/users/${id}`);
  return data;
}

type UpdateUserProfilePayload = {
  email?: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

export async function updateUserProfile(id: string, payload: UpdateUserProfilePayload) {
  const { data } = await api.patch<UserPublic>(`/users/${id}/profile`, payload);
  return data;
}

type UploadImageResponse = {
  url: string;
  fileName: string;
};

export async function uploadProfileImage(file: File) {
  const formData = new FormData();
  formData.append("type", "image");
  formData.append("file", file);

  const { data } = await api.post<UploadImageResponse>("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

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

export async function getHierarchyTree() {
  const { data } = await api.get<HierarchyTreeResponse>("/hierarchy/tree");
  return data;
}

export async function listDepartments() {
  const { data } = await api.get<Department[]>("/departments");
  return data;
}

type CreateDepartmentPayload = {
  name: string;
  parent_id?: string | null;
};

export async function createDepartment(payload: CreateDepartmentPayload) {
  const { data } = await api.post<Department>("/departments", payload);
  return data;
}

type UpdateUserHierarchyPayload = {
  role?: string | null;
  manager_id?: string | null;
  department_id?: string | null;
};

export async function updateUserHierarchy(id: string, payload: UpdateUserHierarchyPayload) {
  const { data } = await api.put<UserPublic>(`/users/${id}/hierarchy`, payload);
  return data;
}

export async function listUsers() {
  const { data } = await api.get<UserPublic[]>("/users");
  return data;
}

type CreateHierarchyNodePayload = {
  title: string;
  type: "department";
  parent_id?: string | null;
  position?: number;
};

export async function createHierarchyNode(payload: CreateHierarchyNodePayload) {
  const { data } = await api.post<HierarchyTreeNode>("/hierarchy/nodes", payload);
  return data;
}

type UpdateHierarchyNodePayload = {
  title?: string;
  parent_id?: string | null;
  position?: number;
  role_title?: string | null;
};

export async function updateHierarchyNode(id: string, payload: UpdateHierarchyNodePayload) {
  const { data } = await api.patch<HierarchyTreeNode>(`/hierarchy/nodes/${id}`, payload);
  return data;
}

export async function deleteHierarchyNode(id: string) {
  const { data } = await api.delete(`/hierarchy/nodes/${id}`);
  return data;
}

type AssignUserPayload = {
  node_id: string;
  user_id: string;
};

export async function assignUserToHierarchy(payload: AssignUserPayload) {
  const { data } = await api.patch<HierarchyTreeNode>("/hierarchy/assign-user", payload);
  return data;
}

export async function updateNodeStatus(nodeId: string, status: "free" | "busy" | "sick") {
  const { data } = await api.patch(`/hierarchy/nodes/${nodeId}/status`, { status });
  return data;
}
