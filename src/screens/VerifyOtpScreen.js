import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Muted, Screen, Title } from '../components/ui';
import OtpInput from '../components/OtpInput';
import { useTheme } from '../theme/ThemeContext';
import { font, spacing } from '../theme/tokens';
import { request } from '../services/api';

export default function VerifyOtpScreen({ navigation, route }) {
  const { c } = useTheme();
  const email = route.params?.email || '';
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const verify = async () => {
    if (otp.length !== 6) return setError('Enter the six-digit code.');
    setBusy(true);
    setError('');
    try {
      const result = await request('/auth/verify-otp', { method: 'POST', auth: false, body: { email, otp } });
      navigation.navigate('NewPassword', { email, resetToken: result.resetToken });
    } catch (e) {
      setError(e.message || 'The code is invalid or expired. Request a new code.');
    } finally { setBusy(false); }
  };
  const resend = async () => {
    setResending(true);
    setError('');
    try {
      await request('/auth/forgot-password', { method: 'POST', auth: false, body: { email } });
      setOtp('');
      setSeconds(60);
    } catch (e) {
      setError(e.status === 429 ? e.message : 'Could not resend the code. Check your connection.');
    } finally { setResending(false); }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <Image source={require('../../assets/logo.png')} style={{ width: 64, height: 64 }} />
            <Title style={{ marginTop: spacing.md, textAlign: 'center' }}>Verify your email</Title>
          </View>
          <Muted style={{ marginTop: 8, marginBottom: spacing.xl }}>Enter the code sent to {email}. The code expires in 10 minutes.</Muted>
          <OtpInput value={otp} onChange={(value) => { setOtp(value); setError(''); }} disabled={busy} />
          {error ? <Text style={{ color: c.expense, fontSize: font.sm, marginTop: spacing.md }}>{error}</Text> : null}
          <Button title="Verify code" onPress={verify} loading={busy} style={{ marginTop: spacing.xl }} />
          <Button title={seconds ? `Resend code in ${seconds}s` : 'Resend code'} variant="secondary" onPress={resend} disabled={seconds > 0 || busy} loading={resending} style={{ marginTop: spacing.sm }} />
          <Button title="Start over" variant="ghost" onPress={() => navigation.navigate('ForgotPassword')} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
