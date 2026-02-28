import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

const LEGACY_ACCESS_TOKEN_KEY = "access_token";
const LEGACY_REFRESH_TOKEN_KEY = "refresh_token";
const CURRENT_USER_ID_KEY = "current_user_id";

let accessTokenMemory: string | null = null;
let redirectingToLogin = false;
let refreshBlockedUntilTs = 0;

function isBrowser() {
  return typeof window !== "undefined";
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

export function getAccessToken() {
  return accessTokenMemory;
}

export function getRefreshToken() {
  return null;
}

export function getCurrentUserId() {
  const token = getAccessToken();
  if (!isBrowser()) {
    return "";
  }

  if (token) {
    const payload = parseJwtPayload(token);
    const subject = payload?.sub;
    return typeof subject === "string" ? subject : "";
  }

  const cached = sessionStorage.getItem(CURRENT_USER_ID_KEY);
  return cached || "";
}

export function setTokens(tokens: AuthTokens) {
  accessTokenMemory = tokens.accessToken || null;
  redirectingToLogin = false;

  if (isBrowser() && tokens.accessToken) {
    const payload = parseJwtPayload(tokens.accessToken);
    const subject = typeof payload?.sub === "string" ? payload.sub : "";
    if (subject) {
      sessionStorage.setItem(CURRENT_USER_ID_KEY, subject);
    }
  }

  // Cleanup legacy storage/cookies if they still exist from older builds.
  if (isBrowser()) {
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    document.cookie = `${LEGACY_ACCESS_TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
    document.cookie = `${LEGACY_REFRESH_TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
  }
}

export function clearTokens() {
  accessTokenMemory = null;
  refreshBlockedUntilTs = 0;
  if (!isBrowser()) return;
  sessionStorage.removeItem(CURRENT_USER_ID_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  document.cookie = `${LEGACY_ACCESS_TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
  document.cookie = `${LEGACY_REFRESH_TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
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
let bootstrapRefreshPromise: Promise<string | null> | null = null;

function subscribeToRefresh(cb: (token: string | null) => void) {
  refreshQueue.push(cb);
}

function notifyRefreshSubscribers(token: string | null) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

function shouldSkipRefresh(url?: string) {
  const normalized = String(url || '');
  return normalized.includes('/auth/login') || normalized.includes('/auth/register') || normalized.includes('/auth/refresh');
}

function getRetryAfterMs(error: AxiosError) {
  const raw = error.response?.headers?.["retry-after"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  const parsedSec = Number(first);
  if (!Number.isFinite(parsedSec) || parsedSec <= 0) {
    return 30_000;
  }
  return parsedSec * 1000;
}

function blockRefreshFor(ms: number) {
  refreshBlockedUntilTs = Date.now() + Math.max(ms, 1_000);
}

function isRefreshBlocked() {
  return Date.now() < refreshBlockedUntilTs;
}

function redirectToLoginIfNeeded() {
  if (!isBrowser() || redirectingToLogin) return;
  redirectingToLogin = true;

  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  const next = encodeURIComponent(currentPath || "/");
  window.location.replace(`/login?next=${next}`);
}

function setAuthorizationHeader(config: InternalAxiosRequestConfig, token: string) {
  const headers = config.headers as unknown as Record<string, string> | undefined;
  if (headers) {
    headers.Authorization = `Bearer ${token}`;
    return;
  }
  config.headers = { Authorization: `Bearer ${token}` } as InternalAxiosRequestConfig["headers"];
}

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshBlocked()) {
    return null;
  }

  if (isRefreshing) {
    return new Promise((resolve) => {
      subscribeToRefresh((token) => resolve(token));
    });
  }

  isRefreshing = true;
  try {
    const refreshResponse = await axios.post<AuthTokens>(
      `${API_BASE}/auth/refresh`,
      {},
      { withCredentials: true },
    );

    const tokens = refreshResponse.data;
    if (!tokens?.accessToken) {
      clearTokens();
      notifyRefreshSubscribers(null);
      return null;
    }

    setTokens(tokens);
    notifyRefreshSubscribers(tokens.accessToken);
    return tokens.accessToken;
  } catch (refreshError) {
    const axiosRefreshError = refreshError as AxiosError;
    const status = axiosRefreshError.response?.status;

    clearTokens();
    notifyRefreshSubscribers(null);

    if (status === 429) {
      blockRefreshFor(getRetryAfterMs(axiosRefreshError));
    } else {
      blockRefreshFor(10_000);
    }

    if (status === 401 || status === 403 || status === 429) {
      redirectToLoginIfNeeded();
    }

    return null;
  } finally {
    isRefreshing = false;
  }
}

async function getOrBootstrapAccessToken() {
  const existing = getAccessToken();
  if (existing) {
    return existing;
  }

  if (!bootstrapRefreshPromise) {
    bootstrapRefreshPromise = refreshAccessToken().finally(() => {
      bootstrapRefreshPromise = null;
    });
  }

  return bootstrapRefreshPromise;
}

api.interceptors.request.use(async (config) => {
  if (shouldSkipRefresh(config.url)) {
    return config;
  }

  const token = await getOrBootstrapAccessToken();
  if (!token) {
    throw new AxiosError("Unauthenticated", "ERR_UNAUTHORIZED", config);
  }

  setAuthorizationHeader(config, token);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (status === 401 && original && !original._retry && !shouldSkipRefresh(original.url)) {
      original._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        setAuthorizationHeader(original, token);
        return api.request(original);
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);
