import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { palette, radius, spacing } from '@/constants/theme';
import { getPublicConfig } from '@/lib/config';
import { getSupabaseClient } from '@/lib/supabase';
import { consumeTransfer } from '@/lib/transfer-api';
import { useGuide } from '@/providers/GuideProvider';

type EmailStep = 'email' | 'otp';

export default function AuthScreen() {
  const { guide } = useGuide();
  const { ticket, review } = useLocalSearchParams<{ ticket?: string; review?: string }>();
  const isReviewLogin = review === '1' && getPublicConfig().reviewLoginEnabled;
  const [emailStep, setEmailStep] = useState<EmailStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function sendOtp() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: authError } = await getSupabaseClient().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (authError) throw authError;
      setEmailStep('otp');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { data, error: authError } = await getSupabaseClient().auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });
      if (authError) throw authError;
      if (!data.session) throw new Error('ログイン情報を確認できませんでした。');
      await finishTransfer(data.session.access_token);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signInWithApple() {
    setError(null);
    setIsSubmitting(true);
    try {
      const rawNonce = Crypto.randomUUID();
      const state = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
        state,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.state !== state) throw new Error('Appleログインを確認できませんでした。');
      if (!credential.identityToken) throw new Error('Appleから認証情報を取得できませんでした。');

      const supabase = getSupabaseClient();
      const { data, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (authError) throw authError;
      if (!data.session) throw new Error('ログイン情報を確認できませんでした。');

      if (credential.fullName?.givenName || credential.fullName?.familyName) {
        const givenName = credential.fullName.givenName ?? '';
        const familyName = credential.fullName.familyName ?? '';
        await supabase.auth.updateUser({
          data: {
            full_name: `${familyName} ${givenName}`.trim(),
            given_name: givenName,
            family_name: familyName,
          },
        });
      }

      await finishTransfer(data.session.access_token);
    } catch (caught) {
      if (!isAppleCancel(caught)) setError(errorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signInReviewAccount() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { data, error: authError } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      if (!data.session) throw new Error('ログイン情報を確認できませんでした。');
      router.replace('/complete' as Href);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function finishTransfer(accessToken: string) {
    if (!ticket) throw new Error('引き継ぎ情報の有効期限が切れました。最初からやり直してください。');
    await consumeTransfer(ticket, accessToken, guide);
    router.replace('/complete' as Href);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <AppScreen contentStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ 戻る</Text>
        </Pressable>

        <View style={styles.heading}>
          <Text style={styles.title}>{isReviewLogin ? '審査用ログイン' : 'アカウントをつくる'}</Text>
          <Text style={styles.lead}>
            {isReviewLogin
              ? '審査メモに記載された専用アカウントを使用します。'
              : '診断結果と毎日の記録を、あなただけの場所に安全に保存します。'}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel="メールアドレス"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="メールアドレス"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={email}
          />

          {isReviewLogin ? (
            <>
              <TextInput
                accessibilityLabel="パスワード"
                onChangeText={setPassword}
                placeholder="パスワード"
                placeholderTextColor={palette.muted}
                secureTextEntry
                style={styles.input}
                value={password}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton
                disabled={!email.includes('@') || password.length < 8}
                label="ログイン"
                loading={isSubmitting}
                onPress={signInReviewAccount}
              />
            </>
          ) : emailStep === 'email' ? (
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton
                disabled={!email.includes('@')}
                label="確認コードを受け取る"
                loading={isSubmitting}
                onPress={sendOtp}
              />

              {Platform.OS === 'ios' ? (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>または</Text>
                    <View style={styles.divider} />
                  </View>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    cornerRadius={999}
                    onPress={signInWithApple}
                    style={styles.appleButton}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.otpHint}>{email} に届いた6桁のコードを入力してください。</Text>
              <TextInput
                accessibilityLabel="確認コード"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={setOtp}
                placeholder="000000"
                placeholderTextColor={palette.muted}
                style={[styles.input, styles.otpInput]}
                value={otp}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton
                disabled={otp.length !== 6}
                label="Aliceをはじめる"
                loading={isSubmitting}
                onPress={verifyOtp}
              />
              <Pressable accessibilityRole="button" onPress={() => setEmailStep('email')} style={styles.secondaryAction}>
                <Text style={styles.secondaryText}>メールアドレスを変更</Text>
              </Pressable>
            </>
          )}
        </View>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '認証に失敗しました。';
}

function isAppleCancel(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_REQUEST_CANCELED';
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.white },
  content: { gap: spacing.xxl, paddingTop: spacing.md },
  backButton: { alignSelf: 'flex-start', paddingVertical: spacing.sm, paddingRight: spacing.lg },
  backText: { color: palette.brand, fontSize: 16, fontWeight: '700' },
  heading: { gap: spacing.sm },
  title: { color: palette.navy, fontSize: 28, fontWeight: '800' },
  lead: { color: palette.textSoft, fontSize: 14, lineHeight: 22 },
  form: { gap: spacing.md },
  input: {
    height: 54,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.canvas,
    paddingHorizontal: spacing.lg,
    color: palette.navy,
    fontSize: 16,
  },
  otpInput: { fontSize: 24, fontWeight: '700', letterSpacing: 8, textAlign: 'center' },
  otpHint: { color: palette.textSoft, fontSize: 13, lineHeight: 20 },
  error: { color: palette.danger, fontSize: 13, lineHeight: 19 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  divider: { flex: 1, height: 1, backgroundColor: palette.border },
  dividerText: { color: palette.muted, fontSize: 12 },
  appleButton: { width: '100%', height: 52 },
  secondaryAction: { alignSelf: 'center', padding: spacing.sm },
  secondaryText: { color: palette.brand, fontSize: 13, fontWeight: '700' },
});
