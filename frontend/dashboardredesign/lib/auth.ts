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
  remember?: boolean;
};

type AuthResponse = {
  token: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

function getErrorMessage(res: Response, data: any) {
  if (data && typeof data === "object" && data.error) {
    return String(data.error);
  }
  return `Request failed (${res.status})`;
}

export async function login(payload: LoginPayload) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(getErrorMessage(res, data));
  }

  const { token } = data as AuthResponse;
  if (token) {
    localStorage.setItem("auth_token", token);
  }

  return data as AuthResponse;
}

export async function register(payload: RegisterPayload) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(getErrorMessage(res, data));
  }

  const { token } = data as AuthResponse;
  if (token) {
    localStorage.setItem("auth_token", token);
  }

  return data as AuthResponse;
}
