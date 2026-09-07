import { SymbolView } from 'expo-symbols';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { ChatAvatar } from '@/components/ui/ChatAvatar';
import { palette, radius, spacing } from '@/constants/theme';
import { AppApiError } from '@/lib/app-api';
import { getChatMessages, getChatMessageStatus, streamChatMessage } from '@/lib/chat-api';
import { getPublicConfig } from '@/lib/config';
import { getSupabaseClient } from '@/lib/supabase';
import { useGuide } from '@/providers/GuideProvider';
import type { ChatMessage } from '@/types/app';

export default function ChatScreen() {
  const { guide } = useGuide();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const guideName = guide === 'alice' ? 'Alice' : 'Harry';

  useEffect(() => {
    let mounted = true;
    const recoveryController = new AbortController();
    async function loadHistory() {
      const config = getPublicConfig();
      if (!config.apiBaseUrl || !config.supabaseUrl || !config.supabaseAnonKey) {
        if (mounted) setIsLoading(false);
        return;
      }
      try {
        const session = (await getSupabaseClient().auth.getSession()).data.session;
        if (!session) return;
        const history = await getChatMessages(session.access_token);
        if (!mounted) return;
        setThreadId(history.thread_id);
        setMessages(history.messages);
        void recoverGeneratingMessages(
          session.access_token,
          history.messages,
          recoveryController.signal,
          (clientMessageId, recovered) => {
            if (!mounted) return;
            setMessages((current) => current.map((item) => (
              item.response_to_client_message_id === clientMessageId
                ? { ...item, ...recovered }
                : item
            )));
          },
        );
      } catch (caught) {
        if (mounted) setError(errorMessage(caught));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void loadHistory();
    return () => {
      mounted = false;
      recoveryController.abort();
      activeRequest.current?.abort();
    };
  }, []);

  const scrollToLatest = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  async function handleSend() {
    const content = message.trim();
    if (!content || isSending) return;

    setError(null);
    setIsSending(true);
    setMessage('');
    const clientMessageId = randomUUID();
    const now = new Date().toISOString();
    const localAssistantId = `assistant-${clientMessageId}`;
    const userMessage: ChatMessage = {
      id: `user-${clientMessageId}`,
      role: 'user',
      content,
      status: 'completed',
      client_message_id: clientMessageId,
      response_to_client_message_id: null,
      created_at: now,
      completed_at: now,
      error_code: null,
    };
    const assistantMessage: ChatMessage = {
      id: localAssistantId,
      role: 'assistant',
      content: '',
      status: 'generating',
      client_message_id: null,
      response_to_client_message_id: clientMessageId,
      created_at: now,
      completed_at: null,
      error_code: null,
    };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    scrollToLatest();

    const controller = new AbortController();
    activeRequest.current = controller;
    let assistantId = localAssistantId;
    let accessToken: string | null = null;
    try {
      const config = getPublicConfig();
      if (!config.apiBaseUrl || !config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error('対話を使うには、開発環境のAPI接続設定が必要です。');
      }
      const session = (await getSupabaseClient().auth.getSession()).data.session;
      if (!session) throw new Error('対話を使うにはログインしてください。');
      accessToken = session.access_token;

      await streamChatMessage({
        accessToken,
        clientMessageId,
        content,
        threadId,
        signal: controller.signal,
        handlers: {
          onMeta: (event) => {
            assistantId = event.assistant_message_id;
            setThreadId(event.thread_id);
            setMessages((current) => current.map((item) => (
              item.id === localAssistantId ? { ...item, id: event.assistant_message_id } : item
            )));
          },
          onDelta: (delta) => {
            setMessages((current) => current.map((item) => (
              item.id === assistantId || item.id === localAssistantId
                ? { ...item, id: assistantId, content: item.content + delta }
                : item
            )));
            scrollToLatest();
          },
          onDone: (event) => {
            assistantId = event.assistant_message_id;
            setMessages((current) => current.map((item) => (
              item.id === assistantId || item.id === localAssistantId
                ? {
                    ...item,
                    id: assistantId,
                    content: event.content,
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                  }
                : item
            )));
          },
        },
      });
    } catch (caught) {
      if (!controller.signal.aborted) {
        const recovered = accessToken
          ? await waitForTerminalMessage(accessToken, clientMessageId, controller.signal).catch(() => null)
          : null;
        if (recovered?.status === 'completed' && recovered.content) {
          assistantId = recovered.id;
          setMessages((current) => current.map((item) => (
            item.id === assistantId || item.id === localAssistantId
              ? {
                  ...item,
                  id: recovered.id,
                  content: recovered.content,
                  status: 'completed',
                  completed_at: recovered.completed_at,
                  error_code: null,
                }
              : item
          )));
          return;
        }
        setMessages((current) => current.map((item) => (
          item.id === assistantId || item.id === localAssistantId
            ? { ...item, id: assistantId, status: 'failed', error_code: 'send_failed' }
            : item
        )));
        setError(errorMessage(caught));
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setIsSending(false);
      scrollToLatest();
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={82} style={styles.fill}>
      <AppScreen scroll={false} contentStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarFrame}>
            <ChatAvatar guide={guide} style={styles.avatar} />
          </View>
          <View>
            <Text style={styles.title}>{guideName}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.brand} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            contentContainerStyle={styles.conversation}
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToLatest}
            renderItem={({ item }) => (
              <MessageBubble message={item} guideName={guideName} />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}

        {error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel={`${guideName}へのメッセージ`}
            multiline
            onChangeText={setMessage}
            onFocus={scrollToLatest}
            onSubmitEditing={Platform.OS === 'web' ? handleSend : undefined}
            placeholder="メッセージを入力"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={message}
            maxLength={4000}
          />
          <Pressable
            accessibilityLabel="送信"
            accessibilityRole="button"
            accessibilityState={{ disabled: !message.trim() || isSending }}
            disabled={!message.trim() || isSending}
            onPress={handleSend}
            style={[styles.send, (!message.trim() || isSending) && styles.sendDisabled]}>
            <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} size={20} tintColor={palette.white} />
          </Pressable>
        </View>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, guideName }: { message: ChatMessage; guideName: string }) {
  const isUser = message.role === 'user';
  if (!isUser && message.status === 'failed') {
    return <Text style={styles.failedMessage}>返答を受け取れませんでした</Text>;
  }
  return (
    <View style={[styles.messageRow, isUser && styles.userMessageRow]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.guideBubble]}>
        {!isUser ? <Text style={styles.bubbleName}>{guideName}</Text> : null}
        {message.status === 'generating' && !message.content ? (
          <Text accessibilityLabel={`${guideName}が返事を考えています`} style={styles.typing}>•••</Text>
        ) : (
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>{message.content}</Text>
        )}
      </View>
    </View>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof AppApiError && error.code === 'subscription_required') {
    return '対話を続けるにはPlusへの登録が必要です。';
  }
  return error instanceof Error ? error.message : 'メッセージを送信できませんでした。';
}

async function waitForTerminalMessage(
  accessToken: string,
  clientMessageId: string,
  signal: AbortSignal,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await getChatMessageStatus(accessToken, clientMessageId, signal);
    if (status.status !== 'generating') return status;
    await abortableDelay(1_000, signal);
  }
  return null;
}

async function recoverGeneratingMessages(
  accessToken: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  onResolved: (
    clientMessageId: string,
    status: Awaited<ReturnType<typeof getChatMessageStatus>>,
  ) => void,
) {
  const pendingIds = new Set(
    messages.flatMap((item) => (
      item.role === 'assistant' &&
      item.status === 'generating' &&
      item.response_to_client_message_id
        ? [item.response_to_client_message_id]
        : []
    )),
  );
  await Promise.all([...pendingIds].map(async (clientMessageId) => {
    try {
      const status = await waitForTerminalMessage(accessToken, clientMessageId, signal);
      if (status) onResolved(clientMessageId, status);
    } catch {
      // A future screen visit retries status recovery; navigation aborts are expected.
    }
  }));
}

function abortableDelay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new Error('chat_recovery_aborted'));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.white },
  content: { paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.border },
  avatarFrame: {
    width: 64,
    height: 64,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.pill,
    backgroundColor: palette.selected,
  },
  avatar: { width: 64, height: 64, transform: [{ translateX: -3 }] },
  title: { color: palette.navy, fontSize: 20, fontWeight: '800' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conversation: { flexGrow: 1, justifyContent: 'flex-end', gap: spacing.md, paddingVertical: spacing.lg },
  messageRow: { alignItems: 'flex-start' },
  userMessageRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '84%', borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  guideBubble: { backgroundColor: palette.selected, borderTopLeftRadius: spacing.xs },
  userBubble: { backgroundColor: palette.brand, borderTopRightRadius: spacing.xs },
  bubbleName: { marginBottom: spacing.xs, color: palette.brand, fontSize: 10, fontWeight: '800' },
  messageText: { color: palette.navy, fontSize: 15, lineHeight: 23 },
  userMessageText: { color: palette.white },
  typing: { color: palette.brand, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  failedMessage: { alignSelf: 'flex-start', color: palette.muted, fontSize: 12 },
  errorBox: { marginBottom: spacing.sm, borderRadius: radius.md, backgroundColor: '#FFF1F3', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  errorText: { color: palette.danger, fontSize: 12, lineHeight: 18 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, backgroundColor: palette.canvas, padding: spacing.sm },
  input: { flex: 1, minHeight: 38, maxHeight: 120, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: palette.navy, fontSize: 15, lineHeight: 21 },
  send: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.brand },
  sendDisabled: { backgroundColor: palette.muted },
});
