import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Input, Muted, Screen, Title } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { font, spacing } from '../theme/tokens';
import { request } from '../services/api';

const passwordPolicy = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function NewPasswordScreen({ navigation, route }) {
  const { c } = useTheme();
  const resetToken = route.params?.resetToken;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!resetToken) return setError('Reset session expired. Start the password reset again.');
    if (!passwordPolicy.test(password)) return setError('Use at least 8 characters with at least one letter and one number.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setBusy(true);
    setError('');
    try {
      const result = await request('/auth/reset-password', {
        method: 'POST', auth: false, body: { resetToken, password, confirmPassword },
      });
      navigation.reset({ index: 0, routes: [{ name: 'Auth', params: { successMessage: result.message } }] });
    } catch (e) {
      setError(e.message || 'Password reset failed. Verify your code again.');
    } finally { setBusy(false); }
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <Image source={require('../../assets/logo.png')} style={{ width: 64, height: 64 }} />
            <Title style={{ marginTop: spacing.md, textAlign: 'center' }}>Choose a new password</Title>
          </View>
          <Muted style={{ marginTop: 8, marginBottom: spacing.xl }}>Use at least 8 characters, including a letter and a number.</Muted>
          <Input label="New password" value={password} onChangeText={setPassword}
            secureTextEntry={!passwordVisible} autoCapitalize="none" autoComplete="new-password"
            rightIcon={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
            rightIconLabel={passwordVisible ? 'Hide password' : 'Show password'}
            onRightIconPress={() => setPasswordVisible((visible) => !visible)} />
          <Input label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword}
            secureTextEntry={!confirmPasswordVisible} autoCapitalize="none" autoComplete="new-password"
            rightIcon={confirmPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
            rightIconLabel={confirmPasswordVisible ? 'Hide password' : 'Show password'}
            onRightIconPress={() => setConfirmPasswordVisible((visible) => !visible)} />
          {error ? <Text style={{ color: c.expense, fontSize: font.sm, marginBottom: spacing.md }}>{error}</Text> : null}
          <Button title="Reset password" onPress={save} loading={busy} />
          <Button title="Start password reset again" variant="ghost" onPress={() => navigation.navigate('ForgotPassword')} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
