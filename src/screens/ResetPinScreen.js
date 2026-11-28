import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import { Button, Input, Muted, Screen, Title } from '../components/ui';
import SetPinScreen from './SetPinScreen';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';
import { biometricAvailability, clearPin, countUnsyncedRecords } from '../services/securityStore';
import { resetLocalData } from '../db';
import { request } from '../services/api';
import { font, spacing } from '../theme/tokens';

export default function ResetPinScreen({ navigation, onComplete }) {
  const { c } = useTheme();
  const { user, signOut } = useAuth();
  const security = useSecurity();
  const [password, setPassword] = useState('');
  const [unsynced, setUnsynced] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    countUnsyncedRecords().then(setUnsynced).catch(() => setUnsynced(0));
    biometricAvailability().then((result) => setBiometricAvailable(result.available)).catch(() => setBiometricAvailable(false));
  }, []);

  const continueToNewPin = () => {
    if (onComplete) setAuthorized(true);
    else navigation.navigate('SetPin', { mode: 'recovery', authorized: true });
  };
  const verifyBiometric = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to reset the Spendly PIN',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use device passcode',
      });
      if (result.success) {
        await security.refresh();
        continueToNewPin();
      }
    } catch { setError('Device verification is unavailable. Use your account password while online.'); }
    finally { setBusy(false); }
  };

  const verifyPassword = async () => {
    if (!password) return setError('Enter your account password.');
    setBusy(true);
    setError('');
    try {
      await request('/auth/verify-password', { method: 'POST', auth: false, body: { email: user?.email, password } });
      setPassword('');
      continueToNewPin();
    } catch (e) {
      setError(e.status === 0 ? 'Internet is required for password verification.' : (e.message || 'Password verification failed.'));
    } finally { setBusy(false); }
  };

  const clearAndSignOut = () => Alert.alert(
    'Erase offline data and sign out?',
    `${unsynced} unsynced record(s) will be permanently deleted from this device. All local transactions and settings for this account will be erased. This cannot be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase and sign out', style: 'destructive', onPress: async () => {
        await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
        await clearPin(user.id);
        await resetLocalData();
        await signOut();
        onComplete?.();
      } },
    ],
  );

  if (authorized) return <SetPinScreen route={{ params: { mode: 'recovery', authorized: true } }} onComplete={onComplete} />;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Title>Reset app PIN</Title>
          <Muted style={{ marginTop: 8, marginBottom: spacing.xl }}>Verify it is you, then choose a new PIN. Your financial data stays on this device.</Muted>
          <Button title={biometricAvailable ? 'Verify with biometrics or device passcode' : 'Try device screen lock'} icon="finger-print-outline" variant="secondary" onPress={verifyBiometric} loading={busy} style={{ marginBottom: spacing.md }} />
          {!biometricAvailable ? <Muted style={{ marginBottom: spacing.md }}>If this device has no screen lock, verify with your account password while online.</Muted> : null}
          <Input label="Account password (requires internet)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
          {error ? <Text style={{ color: c.expense, fontSize: font.sm, marginBottom: spacing.md }}>{error}</Text> : null}
          <Button title="Verify password and reset PIN" icon="lock-open-outline" onPress={verifyPassword} loading={busy} />
          <View style={{ marginTop: spacing.xl, padding: spacing.md, backgroundColor: c.expenseSoft, borderRadius: 8 }}>
            <Text style={{ color: c.expense, fontWeight: '700' }}>Last resort: erase local data</Text>
            <Muted style={{ marginTop: 4 }}>{unsynced} unsynced record(s) will be lost if you continue.</Muted>
            <Button title="Logout and clear this device" icon="trash-outline" variant="danger" onPress={clearAndSignOut} style={{ marginTop: spacing.md }} />
          </View>
          {navigation?.canGoBack() ? <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
