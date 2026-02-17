import { api, getCurrentUserId } from "./api";

export type ChatUser = {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  department_name?: string | null;
  thread_id?: string | null;
  online: boolean;
  last_seen?: string | null;
  last_message?: string | null;
  last_message_type?: string | null;
  last_message_at?: string | null;
  last_message_sender?: string | null;
};

export type ChatThread = {
  id: string;
  name: string;
  avatar_url?: string | null;
  is_group: boolean;
  partner_id?: string | null;
  partner_email?: string | null;
  partner_full_name?: string | null;
  partner_avatar_url?: string | null;
  partner_role?: string | null;
  partner_department?: string | null;
  online: boolean;
  last_message?: string | null;
  last_message_type?: string | null;
  last_message_at?: string | null;
  last_message_sender?: string | null;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  text?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  created_at: string;
};

export type UploadKind = "image" | "video" | "file";

type UploadResponse = {
  url: string;
  fileName: string;
};

export async function touchChatPresence() {
  await api.post("/chats/presence");
}

export async function listChatUsers(limit = 40) {
  const { data } = await api.get<ChatUser[]>("/chats/users", { params: { limit } });
  return Array.isArray(data) ? data : [];
}

export async function listChatThreads(limit = 60) {
  const { data } = await api.get<ChatThread[]>("/chats/threads", { params: { limit } });
  return Array.isArray(data) ? data : [];
}

export async function getChatUnreadCount() {
  const { data } = await api.get<{ count?: number }>("/chats/unread-count");
  return Number(data?.count || 0);
}

export async function ensureDirectThread(userId: string) {
  const { data } = await api.post<ChatThread>("/chats/threads/direct", { userId });
  return data;
}

export async function createGroupThread(name: string, memberIds: string[]) {
  const { data } = await api.post<ChatThread>("/chats/threads/group", {
    name,
    memberIds,
  });
  return data;
}

export async function renameChatThread(threadId: string, name: string) {
  const { data } = await api.patch<ChatThread>(`/chats/threads/${threadId}`, {
    name,
  });
  return data;
}

export async function inviteThreadToCall(threadId: string, roomId: string) {
  const { data } = await api.post<{ ok?: boolean }>(`/chats/threads/${threadId}/call-invite`, {
    roomId,
  });
  return Boolean(data?.ok);
}

export async function listThreadMessages(threadId: string, limit = 80) {
  const { data } = await api.get<ChatMessage[]>(`/chats/threads/${threadId}/messages`, {
    params: { limit },
  });
  return Array.isArray(data) ? data : [];
}

type SendMessagePayload = {
  text?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
};

export async function sendThreadMessage(threadId: string, payload: SendMessagePayload) {
  const { data } = await api.post<ChatMessage>(`/chats/threads/${threadId}/messages`, payload);
  return data;
}

function detectUploadKind(file: File): UploadKind {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  return "file";
}

export async function uploadChatAttachment(file: File) {
  const form = new FormData();
  const type = detectUploadKind(file);
  form.append("type", type);
  form.append("file", file);

  const { data } = await api.post<UploadResponse>("/upload", form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return {
    url: data.url,
    fileName: data.fileName,
    type,
  };
}

export function isOwnChatMessage(message: ChatMessage) {
  const currentUserID = getCurrentUserId();
  return Boolean(currentUserID) && currentUserID === message.sender_id;
}

