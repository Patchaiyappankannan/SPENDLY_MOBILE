import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, Image } from 'react-native';
import { Button, Input, Muted, Screen, Title } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { font, spacing } from '../theme/tokens';
import { request } from '../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const { c } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return setError('Enter your registered email address.');
    setBusy(true);
    setError('');
    try {
      const result = await request('/auth/forgot-password', { method: 'POST', auth: false, body: { email: normalizedEmail } });
      navigation.navigate('VerifyOtp', { email: normalizedEmail, message: result.message });
    } catch (e) {
      setError(e.status === 429 ? e.message : 'Could not request a code. Check your connection and try again.');
    } finally { setBusy(false); }
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <Image source={require('../../assets/logo.png')} style={{ width: 64, height: 64 }} />
            <Title style={{ marginTop: spacing.md, textAlign: 'center' }}>Reset password</Title>
          </View>
          <Muted style={{ marginTop: 8, marginBottom: spacing.xl }}>Enter the email used for your Spendly account. If it is registered, we will send a verification code.</Muted>
          <Input label="Email" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="Enter Your Email " autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          {error ? <Text style={{ color: c.expense, fontSize: font.sm, marginBottom: spacing.md }}>{error}</Text> : null}
          <Button title="Send verification code" onPress={sendCode} loading={busy} />
          <Button title="Back to sign in" variant="secondary" onPress={() => navigation.goBack()} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
