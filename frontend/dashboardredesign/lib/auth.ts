import { api, getApiErrorMessage, setTokens } from "./api";

type LoginPayload = {
  email: string;
  password: string;
  remember?: boolean;
};

type RegisterPayload = {
  email: string;
  password: string;
  org_id?: number;
  role?: string;
  name?: string;
  full_name?: string;
  fullName?: string;
  remember?: boolean;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

type UserResponse = {
  id: string;
  email: string;
  role?: string | null;
  manager_id?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  created_at: string;
};

export async function login(payload: LoginPayload) {
  try {
    const { data } = await api.post<AuthResponse>("/auth/login", {
      email: payload.email,
      password: payload.password,
    });

    if (data.accessToken && data.refreshToken) {
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    }

    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}

export async function register(payload: RegisterPayload) {
  try {
    const { data } = await api.post<UserResponse>("/auth/register", {
      email: payload.email,
      password: payload.password,
      name: payload.name,
      full_name: payload.full_name || payload.fullName || payload.name,
    });

    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}
