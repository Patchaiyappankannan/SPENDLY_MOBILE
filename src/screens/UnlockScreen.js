import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Muted, Screen, Title } from '../components/ui';
import PinPad from '../components/PinPad';
import { useTheme } from '../theme/ThemeContext';
import { useSecurity } from '../context/SecurityContext';
import { useAuth } from '../context/AuthContext';
import { getPinLockoutUntil } from '../services/securityStore';
import { font, spacing } from '../theme/tokens';

export default function UnlockScreen({ onForgotPin }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const security = useSecurity();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    getPinLockoutUntil(security.userId).then((until) => { setLockedUntil(until); setTick(Date.now()); }).catch(() => {});
  }, [security.userId]);
  useEffect(() => {
    if (!lockedUntil || lockedUntil <= tick) return undefined;
    const timer = setTimeout(() => setTick(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [lockedUntil, tick]);

  const enterPin = async (value) => {
    setDigits(value);
    setError('');
    if (value.length !== security.pinLength || busy) return;
    setBusy(true);
    const result = await security.unlockWithPin(value);
    setBusy(false);
    setDigits('');
    if (result.ok) return;
    if (result.lockedUntil) {
      setLockedUntil(result.lockedUntil);
      setError(`Too many attempts. Try again in ${Math.max(1, Math.ceil((result.lockedUntil - Date.now()) / 1000))} seconds.`);
    } else setError(result.attemptsRemaining ? `PIN is incorrect. ${result.attemptsRemaining} attempts left.` : 'PIN could not be verified.');
  };

  const biometric = async () => {
    setBusy(true);
    setError('');
    const result = await security.unlockWithBiometrics();
    setBusy(false);
    if (!result.success && result.error) setError(result.error);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <View style={{ width: 58, height: 58, borderRadius: 16, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
            <Ionicons name="lock-closed" size={27} color={c.primary} />
          </View>
          <Title>Unlock Spendly</Title>
          <Muted style={{ marginTop: 6 }}>{user?.name || 'Enter your app PIN'}</Muted>
        </View>
        <PinPad value={digits} onChange={enterPin} length={security.pinLength} disabled={busy || lockedUntil > tick} />
        {error ? <Text style={{ color: c.expense, textAlign: 'center', fontSize: font.sm, marginTop: spacing.sm }}>{error}</Text> : null}
        {security.biometricEnabled ? <Button title="Unlock with biometrics" icon="finger-print-outline" variant="secondary" onPress={biometric} disabled={busy || lockedUntil > tick} style={{ marginTop: spacing.lg }} /> : null}
        <Pressable onPress={onForgotPin} style={{ alignSelf: 'center', padding: spacing.lg }} accessibilityRole="button">
          <Text style={{ color: c.primary, fontSize: font.sm, fontWeight: '600' }}>Forgot PIN?</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
