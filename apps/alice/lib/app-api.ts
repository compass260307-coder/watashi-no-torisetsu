import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getPublicConfig } from '@/lib/config';
import type {
  AnswerValue,
  BootstrapResponse,
  DailyCompleteResponse,
  DailyStartResponse,
  Mood,
} from '@/types/app';

type ApiErrorBody = {
  code?: string;
  message?: string;
  retryable?: boolean;
  request_id?: string;
};

export class AppApiError extends Error {
  code: string;
  retryable: boolean;
  requestId?: string;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? '通信に失敗しました。');
    this.name = 'AppApiError';
    this.status = status;
    this.code = body.code ?? 'unknown_error';
    this.retryable = body.retryable ?? status >= 500;
    this.requestId = body.request_id;
  }
}

export function getBootstrap(accessToken: string) {
  return appRequest<BootstrapResponse>('/api/app/v1/bootstrap', { method: 'GET' }, accessToken);
}

export function startDaily(accessToken: string) {
  return appRequest<DailyStartResponse>('/api/app/v1/daily/start', { method: 'POST' }, accessToken);
}

export function completeDaily(
  accessToken: string,
  input: {
    checkinId: string;
    mood: Mood;
    answers: { questionId: number; value: AnswerValue }[];
    journal: string;
  },
) {
  return appRequest<DailyCompleteResponse>(
    '/api/app/v1/daily/complete',
    {
      method: 'POST',
      body: JSON.stringify({
        checkin_id: input.checkinId,
        mood: input.mood,
        answers: input.answers.map((answer) => ({
          question_id: answer.questionId,
          value: answer.value,
        })),
        journal: input.journal,
      }),
    },
    accessToken,
  );
}

async function appRequest<T>(path: string, init: RequestInit, accessToken?: string): Promise<T> {
  const { apiBaseUrl } = getPublicConfig();
  if (!apiBaseUrl) {
    throw new Error('APIの接続先がありません。.envを設定してください。');
  }

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
      throw new AppApiError(response.status, body ?? {});
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
