import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getPublicConfig } from '@/lib/config';
import type { Guide } from '@/types/foundation';

type ApiErrorBody = {
  code?: string;
  message?: string;
  retryable?: boolean;
  request_id?: string;
};

type TransferValidationResponse = {
  claim_ticket: string;
  expires_at: string;
};

export class TransferApiError extends Error {
  code: string;
  retryable: boolean;
  requestId?: string;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? '通信に失敗しました。');
    this.name = 'TransferApiError';
    this.status = status;
    this.code = body.code ?? 'unknown_error';
    this.retryable = body.retryable ?? status >= 500;
    this.requestId = body.request_id;
  }
}

export function validateTransferCode(code: string) {
  return appRequest<TransferValidationResponse>('/api/app/v1/transfer/validate', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function consumeTransfer(claimTicket: string, accessToken: string, guide: Guide) {
  return appRequest<{ active_snapshot_id: string }>(
    '/api/app/v1/transfer/consume',
    {
      method: 'POST',
      body: JSON.stringify({
        claim_ticket: claimTicket,
        guide,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo',
      }),
    },
    accessToken,
  );
}

async function appRequest<T>(path: string, init: RequestInit, accessToken?: string): Promise<T> {
  const { apiBaseUrl } = getPublicConfig();
  if (!apiBaseUrl) throw new Error('APIの接続先がありません。.envを設定してください。');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-App-Version': Constants.expoConfig?.version ?? '0.0.0',
        'X-Platform': Platform.OS,
        'X-Locale': 'ja-JP',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const body = await safeJson<ApiErrorBody>(response);
      throw new TransferApiError(response.status, body ?? {});
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
