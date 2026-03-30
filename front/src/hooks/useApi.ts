import { useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { normalizeUiError } from '../utils/formUtils';

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ||
  'http://localhost:3001';

// Funcao responsavel por centralizar chamadas autenticadas para a API de negocio e padronizar tratamento de resposta/erro.
export function useApi() {
  const { accessToken } = useAuth();

  const request = useCallback(async (
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; data: any; message?: string }> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/inserts${endpoint}`, {
        ...options,
        credentials: 'include',
        headers,
      });

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const raw = await res.text();
      const data = isJson && raw ? JSON.parse(raw) : null;

      if (!isJson) {
        return {
          ok: false,
          data: null,
          message: normalizeUiError(`Resposta inesperada da API (${res.status}). Verifique a URL da API em VITE_API_BASE_URL.`),
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          data: null,
          message: normalizeUiError(data?.message || `Erro ${res.status}`),
        };
      }

      return { ok: true, data };
    } catch (err) {
      return {
        ok: false,
        data: null,
        message: normalizeUiError(err instanceof Error ? err.message : 'Erro na requisição'),
      };
    }
  }, [accessToken]);

  return { request };
}
