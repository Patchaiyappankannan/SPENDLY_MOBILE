import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Chip, Muted, Screen, Title } from '../components/ui';
import PinPad from '../components/PinPad';
import { useTheme } from '../theme/ThemeContext';
import { useSecurity } from '../context/SecurityContext';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';

export default function SetPinScreen({ navigation, route, onComplete }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const security = useSecurity();
  const { changed } = useSync();
  const mode = route?.params?.mode || 'setup';
  const recoveryAuthorized = !!route?.params?.authorized || mode === 'setup';
  const changing = mode === 'change';
  const [stage, setStage] = useState(changing ? 'current' : 'new');
  const [length, setLength] = useState(security.pinLength || 4);
  const [digits, setDigits] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (changing) setLength(security.pinLength || 4);
  }, [changing, security.pinLength]);

  const title = stage === 'current' ? 'Enter current PIN' : stage === 'new' ? 'Set a new PIN' : 'Confirm your PIN';
  const activeLength = stage === 'current' ? (security.pinLength || 4) : length;

  const input = async (value) => {
    setDigits(value);
    setError('');
    if (value.length !== activeLength || busy) return;
    if (stage === 'current') {
      setBusy(true);
      const result = await security.unlockWithPin(value);
      setBusy(false);
      setDigits('');
      if (!result.ok) {
        setError(result.lockedUntil ? `Try again in ${Math.max(1, Math.ceil((result.lockedUntil - Date.now()) / 1000))} seconds.` : 'Current PIN is incorrect.');
        return;
      }
      setStage('new');
      return;
    }
    if (stage === 'new') {
      setFirstPin(value);
      setDigits('');
      setStage('confirm');
      return;
    }
    if (value !== firstPin) {
      setFirstPin('');
      setDigits('');
      setStage('new');
      setError('PINs did not match. Choose your new PIN again.');
      return;
    }
    if (!recoveryAuthorized && mode === 'recovery') {
      setError('Verify your identity before setting a new PIN.');
      setDigits('');
      return;
    }
    setBusy(true);
    try {
      await security.installPin(value);
      await changed();
      if (onComplete) onComplete();
      else if (navigation?.canGoBack()) navigation.goBack();
    } catch (e) {
      setError(e.message || 'Could not save your PIN.');
      setDigits('');
    } finally { setBusy(false); }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
        <Title style={{ textAlign: 'center' }}>{title}</Title>
        <Muted style={{ textAlign: 'center', marginTop: 8, marginBottom: spacing.xl }}>
          {changing && stage === 'current' ? 'Confirm your current PIN to continue.' : "Your PIN is protected in this device's secure storage."}
        </Muted>
        {stage !== 'current' ? <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
          {[4, 6].map((value) => <Chip key={value} label={`${value} digits`} active={length === value} onPress={() => { setLength(value); setDigits(''); setFirstPin(''); setError(''); setStage('new'); }} />)}
        </View> : null}
        <PinPad value={digits} onChange={input} length={activeLength} disabled={busy} />
        {error ? <Text style={{ color: c.expense, textAlign: 'center', fontSize: font.sm, marginTop: spacing.md }}>{error}</Text> : null}
        {busy ? <Muted style={{ textAlign: 'center', marginTop: spacing.md }}>Saving securely…</Muted> : null}
        {navigation?.canGoBack() ? <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }} /> : null}
      </View>
    </Screen>
  );
}
