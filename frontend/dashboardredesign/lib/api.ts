import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

function isBrowser() {
  return typeof window !== "undefined";
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isBrowser()) return;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`;
}

function clearCookie(name: string) {
  if (!isBrowser()) return;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax${secure}`;
}

export function getAccessToken() {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const parsed = JSON.parse(window.atob(padded)) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

export function getCurrentUserId() {
  const token = getAccessToken();
  if (!token || !isBrowser()) {
    return "";
  }

  const payload = parseJwtPayload(token);
  const subject = payload?.sub;
  return typeof subject === "string" ? subject : "";
}

export function setTokens(tokens: AuthTokens) {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  setCookie(ACCESS_TOKEN_KEY, tokens.accessToken, ACCESS_TOKEN_MAX_AGE);
  setCookie(REFRESH_TOKEN_KEY, tokens.refreshToken, REFRESH_TOKEN_MAX_AGE);
}

export function clearTokens() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearCookie(ACCESS_TOKEN_KEY);
  clearCookie(REFRESH_TOKEN_KEY);
}

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

function localizeApiError(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (normalized === 'invalid credentials') return 'Неверный email или пароль';
  if (normalized === 'email and password are required') return 'Введите email и пароль';
  if (normalized === 'invalid email') return 'Некорректный email';
  if (normalized === 'email already registered') return 'Этот email уже зарегистрирован';

  if (normalized.includes('zhcp parser error') && normalized.includes('connection refused')) {
    return 'Сервис парсера ЖЦП сейчас недоступен (connection refused). Проверьте, что контейнер zhcp-parser запущен, и повторите попытку.';
  }

  if (normalized.includes('parser returned unsuccessful result')) {
    return 'Парсер не смог извлечь структуру из документа. Проверьте, что файл не поврежден и соответствует формату (.pdf, .docx, .txt).';
  }

  if (normalized.includes('zhcp parser error')) {
    return 'Не удалось обработать документ парсером ЖЦП. Проверьте формат/содержимое файла и попробуйте снова.';
  }

  if (normalized.includes('zhcp-parser:8081') && normalized.includes('connection refused')) {
    return 'Не удалось подключиться к zhcp-parser:8081. Запустите сервис парсера и попробуйте снова.';
  }

  if (normalized.includes('dial tcp') && normalized.includes('connection refused')) {
    return 'Один из внутренних сервисов недоступен (connection refused). Проверьте docker compose и запущенные контейнеры.';
  }

  if (normalized.includes('request failed with status code')) {
    return 'Сервис временно вернул ошибку. Попробуйте еще раз через минуту.';
  }

  if (normalized.includes('network error')) {
    return 'Сетевая ошибка. Проверьте подключение и доступность сервисов.';
  }

  return message;
}

export function getApiErrorMessage(error: unknown, fallback = "Request failed") {
  const axiosError = error as AxiosError<{ error?: string }>;
  if (axiosError?.response?.data?.error) {
    return localizeApiError(String(axiosError.response.data.error));
  }

  if (axiosError?.message) {
    const msg = String(axiosError.message);
    const normalized = msg.trim().toLowerCase();
    const isTechnicalAxiosMessage =
      normalized.includes('request failed with status code')
      || normalized.includes('network error')
      || normalized.includes('timeout');

    if (!isTechnicalAxiosMessage) {
      return localizeApiError(msg);
    }
  }

  return localizeApiError(fallback);
}

export function getApiStatus(error: unknown) {
  const axiosError = error as AxiosError;
  return axiosError?.response?.status;
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function subscribeToRefresh(cb: (token: string | null) => void) {
  refreshQueue.push(cb);
}

function notifyRefreshSubscribers(token: string | null) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (status === 401 && original && !original._retry) {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        return Promise.reject(error);
      }

      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeToRefresh((token) => {
            if (!token) {
              reject(error);
              return;
            }

            original.headers = {
              ...original.headers,
              Authorization: `Bearer ${token}`,
            };

            resolve(api.request(original));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshResponse = await axios.post<AuthTokens>(`${API_BASE}/auth/refresh`, {
          refreshToken,
        });

        const tokens = refreshResponse.data;
        setTokens(tokens);

        notifyRefreshSubscribers(tokens.accessToken);

        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${tokens.accessToken}`,
        };

        return api.request(original);
      } catch (refreshError) {
        clearTokens();
        notifyRefreshSubscribers(null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
