'use client';

import { useEffect, useRef, useState } from 'react';
import { api, getAccessToken, getApiErrorMessage } from '@/lib/api';

type AutosaveType = 'project' | 'task' | 'page';

interface UseAutosaveParams {
  id: string;
  type: AutosaveType;
  data: unknown;
  endpoint?: string;
  onSaved?: (responseData: unknown) => void;
  debounceMs?: number;
  enabled?: boolean;
}

const DEBOUNCE_MS = 1500;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 700;

type SaveStatusValue = 'idle' | 'saving' | 'saved' | 'error';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useAutosave({ id, type, data, endpoint: endpointOverride, onSaved, debounceMs, enabled = true }: UseAutosaveParams) {
  const [saveStatus, setSaveStatus] = useState<SaveStatusValue>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPayloadRef = useRef<string>('');
  const lastSavedPayloadRef = useRef<string>('');
  const latestPayloadRawRef = useRef<string>('{}');
  const latestPayloadKeyRef = useRef<string>('');
  const latestEndpointRef = useRef<string>('');
  const latestMethodRef = useRef<'PATCH'>('PATCH');
  const onSavedRef = useRef<UseAutosaveParams['onSaved']>(onSaved);
  const requestSeqRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const persistWithRetry = async (
    endpoint: string,
    payloadRaw: string,
    payloadKey: string,
    requestSeq: number,
  ) => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        const response = await api.patch(endpoint, JSON.parse(payloadRaw));

        if (!isMountedRef.current || requestSeq !== requestSeqRef.current) {
          return;
        }

        lastSavedPayloadRef.current = payloadKey;
        setSaveError(null);
        setSaveStatus('saved');
        onSavedRef.current?.(response.data);
        return;
      } catch (error) {
        if (!isMountedRef.current || requestSeq !== requestSeqRef.current) {
          return;
        }

        if (attempt === MAX_RETRIES - 1) {
          setSaveStatus('error');
          setSaveError(getApiErrorMessage(error, 'Изменения не сохранены'));
          lastPayloadRef.current = '';
          return;
        }

        const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
        await sleep(delay);
      }
    }
  };

  const flushPendingWithKeepalive = () => {
    if (!id) return;

    const endpoint = latestEndpointRef.current;
    const method = latestMethodRef.current;
    const payloadRaw = latestPayloadRawRef.current;
    const payloadKey = latestPayloadKeyRef.current;

    if (!endpoint || !payloadRaw || !payloadKey) {
      return;
    }

    if (payloadKey === lastSavedPayloadRef.current) {
      return;
    }

    const baseURL = String(api.defaults.baseURL || '');
    const token = getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    void fetch(`${baseURL}${endpoint}`, {
      method,
      headers,
      body: payloadRaw,
      keepalive: true,
      credentials: 'include',
    });
  };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!id || !enabled) {
      return;
    }

    const payload = JSON.stringify(data ?? {});
    const payloadKey = `${type}:${id}:${payload}`;
    const endpoint = endpointOverride || (type === 'project'
      ? `/projects/${id}`
      : type === 'task'
        ? `/tasks/${id}`
        : '');

    if (!endpoint) {
      setSaveStatus('idle');
      return;
    }

    latestPayloadRawRef.current = payload;
    latestPayloadKeyRef.current = payloadKey;
    latestEndpointRef.current = endpoint;
    latestMethodRef.current = 'PATCH';

    if (payloadKey === lastPayloadRef.current) return;

    lastPayloadRef.current = payloadKey;
    requestSeqRef.current += 1;
    const requestSeq = requestSeqRef.current;
    setSaveError(null);
    setSaveStatus('saving');

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      await persistWithRetry(endpoint, payload, payloadKey, requestSeq);
    }, debounceMs ?? DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [data, enabled, endpointOverride, id, type]);

  useEffect(() => {
    if (!id || !enabled) return;

    const handlePageHide = () => {
      flushPendingWithKeepalive();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingWithKeepalive();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, id]);

  return { saveStatus, saveError };
}

export default useAutosave;
