import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { Button, Input, Muted, Screen, Title } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { font, spacing } from '../theme/tokens';

export default function ChangeEmailScreen({ navigation }) {
  const { c } = useTheme();
  const { user, updateEmail } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your current password to confirm this change.');
    setBusy(true);
    setError('');
    try {
      await updateEmail(email.trim().toLowerCase(), password);
      setPassword('');
      navigation.goBack();
    } catch (e) {
      setError(e.message || 'Could not change your email. Please try again.');
    } finally { setBusy(false); }
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Title>Change email</Title>
          <Muted style={{ marginTop: 8, marginBottom: spacing.xl }}>Your current password is required to update the email on your account.</Muted>
          <Input label="New email address" icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Input label="Current password" icon="lock-closed-outline" value={password} onChangeText={setPassword}
            secureTextEntry={!passwordVisible} autoCapitalize="none" autoComplete="current-password"
            rightIcon={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
            rightIconLabel={passwordVisible ? 'Hide password' : 'Show password'}
            onRightIconPress={() => setPasswordVisible((visible) => !visible)} />
          {error ? <Text style={{ color: c.expense, fontSize: font.sm, marginBottom: spacing.md }}>{error}</Text> : null}
          <Button title="Save email" onPress={save} loading={busy} />
          <Button title="Cancel" variant="secondary" onPress={() => navigation.goBack()} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
