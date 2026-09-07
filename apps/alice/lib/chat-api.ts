import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

import { AppApiError } from '@/lib/app-api';
import { getPublicConfig } from '@/lib/config';
import type {
  ChatMessagesResponse,
  ChatMessageStatusResponse,
  ChatStreamDone,
  ChatStreamMeta,
} from '@/types/app';

type StreamErrorBody = {
  code?: string;
  message?: string;
  retryable?: boolean;
  request_id?: string;
};

type ChatStreamHandlers = {
  onMeta?: (event: ChatStreamMeta) => void;
  onDelta?: (text: string) => void;
  onDone?: (event: ChatStreamDone) => void;
};

export async function getChatMessages(accessToken: string) {
  const response = await fetch(apiUrl('/api/app/v1/chat/messages'), {
    method: 'GET',
    headers: apiHeaders(accessToken, 'application/json'),
  });
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as ChatMessagesResponse;
}

export async function getChatMessageStatus(
  accessToken: string,
  clientMessageId: string,
  signal?: AbortSignal,
) {
  const response = await fetch(
    apiUrl(`/api/app/v1/chat/messages/${clientMessageId}/status`),
    {
      method: 'GET',
      signal,
      headers: apiHeaders(accessToken, 'application/json'),
    },
  );
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as ChatMessageStatusResponse;
}

export async function streamChatMessage(input: {
  accessToken: string;
  clientMessageId: string;
  content: string;
  threadId: string | null;
  signal: AbortSignal;
  handlers: ChatStreamHandlers;
}) {
  const response = await expoFetch(apiUrl('/api/app/v1/chat'), {
    method: 'POST',
    signal: input.signal,
    headers: apiHeaders(input.accessToken, 'text/event-stream'),
    body: JSON.stringify({
      client_message_id: input.clientMessageId,
      content: input.content,
      thread_id: input.threadId,
    }),
  });

  if (!response.ok) throw await apiError(response);
  if (!response.body) {
    throw new Error('応答を受信できませんでした。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneEvent: ChatStreamDone | null = null;

  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value, { stream: !chunk.done });
    buffer = await consumeSseBuffer(buffer, (event, data) => {
      if (event === 'meta') {
        input.handlers.onMeta?.(data as ChatStreamMeta);
        return;
      }
      if (event === 'delta') {
        const text = typeof data.text === 'string' ? data.text : '';
        if (text) input.handlers.onDelta?.(text);
        return;
      }
      if (event === 'done') {
        doneEvent = data as ChatStreamDone;
        input.handlers.onDone?.(doneEvent);
        return;
      }
      if (event === 'error') {
        throw new AppApiError(503, data as StreamErrorBody);
      }
    });
    if (chunk.done) break;
  }

  if (!doneEvent && !input.signal.aborted) {
    throw new Error('返答が途中で終了しました。もう一度お試しください。');
  }
  return doneEvent;
}

async function consumeSseBuffer(
  buffer: string,
  consume: (event: string, data: Record<string, unknown>) => void,
) {
  let remaining = buffer;
  while (true) {
    const match = /\r?\n\r?\n/.exec(remaining);
    if (!match || match.index === undefined) return remaining;
    const block = remaining.slice(0, match.index);
    remaining = remaining.slice(match.index + match[0].length);
    if (!block.trim()) continue;

    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) continue;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
    } catch {
      throw new Error('返答データを読み取れませんでした。');
    }
    consume(event, data);
  }
}

function apiUrl(path: string) {
  const { apiBaseUrl } = getPublicConfig();
  if (!apiBaseUrl) {
    throw new Error('APIの接続先がありません。.envを設定してください。');
  }
  return `${apiBaseUrl}${path}`;
}

function apiHeaders(accessToken: string, accept: string) {
  return {
    Accept: accept,
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'X-App-Version': Constants.expoConfig?.version ?? '0.0.0',
    'X-Platform': Platform.OS,
    'X-Locale': 'ja-JP',
  };
}

async function apiError(response: Pick<Response, 'status' | 'json'>) {
  let body: StreamErrorBody = {};
  try {
    body = (await response.json()) as StreamErrorBody;
  } catch {
    // A stable fallback message is supplied by AppApiError.
  }
  return new AppApiError(response.status, body);
}
