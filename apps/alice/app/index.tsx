import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { GuideFigure } from '@/components/ui/GuideFigure';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { palette, radius, spacing } from '@/constants/theme';
import { getPublicConfig } from '@/lib/config';
import { validateTransferCode } from '@/lib/transfer-api';
import { useBootstrap } from '@/providers/BootstrapProvider';

export default function TransferScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: bootstrap, isLoading: isBootstrapLoading } = useBootstrap();
  const { apiBaseUrl, reviewLoginEnabled } = getPublicConfig();
  const hasApiConfig = Boolean(apiBaseUrl);
  const normalizedCode = normalizeCode(code);

  useEffect(() => {
    if (!isBootstrapLoading && bootstrap) router.replace('/(tabs)');
  }, [bootstrap, isBootstrapLoading]);

  function openWebTransfer() {
    if (apiBaseUrl) void Linking.openURL(`${apiBaseUrl}/alice`);
  }

  async function handleContinue() {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await validateTransferCode(normalizedCode);
      router.push({ pathname: '/auth', params: { ticket: result.claim_ticket } });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <AppScreen contentStyle={styles.content}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Alice</Text>
          <View style={styles.star} />
        </View>

        <View style={styles.hero}>
          <GuideFigure guide="alice" style={styles.character} />
          <Text style={styles.title}>診断したあなたを、{`\n`}ここから一緒に育てよう。</Text>
          <Text style={styles.lead}>Web診断の結果を引き継いで、毎日の変化をAliceと見つけていきます。</Text>
        </View>

        <SurfaceCard>
          <Text style={styles.label}>Webに表示された引き継ぎコード</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="引き継ぎコード"
            onChangeText={setCode}
            placeholder="例：ABCD-EFGH"
            placeholderTextColor={palette.muted}
            returnKeyType="done"
            style={styles.input}
            value={code}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            disabled={!isValidCode(normalizedCode) || !hasApiConfig}
            label="診断結果を引き継ぐ"
            loading={isSubmitting}
            onPress={handleContinue}
          />
          {!hasApiConfig ? (
            <Text style={styles.setupNote}>開発環境のAPI接続先を設定すると、コード確認が有効になります。</Text>
          ) : null}
        </SurfaceCard>

        <Pressable
          accessibilityRole="link"
          disabled={!hasApiConfig}
          onPress={openWebTransfer}
          style={styles.webLink}>
          <Text style={styles.webLinkText}>コードがない方はWebで発行</Text>
        </Pressable>

        {__DEV__ ? (
          <View style={styles.devLinks}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/daily', params: { demo: '1' } })}
              style={styles.demoLink}>
              <Text style={styles.demoLinkText}>日次体験デモを確認する</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)')} style={styles.devLink}>
              <Text style={styles.devLinkText}>開発用：アプリ全体を確認</Text>
            </Pressable>
          </View>
        ) : null}

        {reviewLoginEnabled ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/auth', params: { review: '1' } })}
            style={styles.reviewLink}>
            <Text style={styles.reviewLinkText}>審査用アカウントでログイン</Text>
          </Pressable>
        ) : null}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function normalizeCode(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

function isValidCode(value: string) {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'コードを確認できませんでした。';
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.white },
  content: { justifyContent: 'center', gap: spacing.xl, paddingTop: spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  brand: { color: palette.brand, fontSize: 42, fontWeight: '800', letterSpacing: -1.5 },
  star: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: palette.lightBlue },
  hero: { alignItems: 'center' },
  character: { width: 132, height: 165 },
  title: { color: palette.navy, fontSize: 24, fontWeight: '800', lineHeight: 34, textAlign: 'center' },
  lead: { maxWidth: 340, marginTop: spacing.sm, color: palette.textSoft, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  label: { marginBottom: spacing.sm, color: palette.navy, fontSize: 13, fontWeight: '700' },
  input: {
    height: 54,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.canvas,
    paddingHorizontal: spacing.lg,
    color: palette.navy,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  error: { marginBottom: spacing.md, color: palette.danger, fontSize: 13, lineHeight: 19 },
  setupNote: { marginTop: spacing.md, color: palette.textSoft, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  devLinks: { alignItems: 'center', gap: spacing.sm },
  demoLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.selected, paddingHorizontal: spacing.xl },
  demoLinkText: { color: palette.brand, fontSize: 13, fontWeight: '800' },
  devLink: { alignSelf: 'center', padding: spacing.sm },
  devLinkText: { color: palette.brand, fontSize: 13, fontWeight: '700' },
  reviewLink: { alignSelf: 'center', padding: spacing.sm },
  reviewLinkText: { color: palette.muted, fontSize: 12 },
  webLink: { alignSelf: 'center', padding: spacing.sm },
  webLinkText: { color: palette.brand, fontSize: 13, fontWeight: '800' },
});
