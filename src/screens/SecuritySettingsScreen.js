import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Muted, Screen, SectionHeader, Segmented, Title } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSecurity } from '../context/SecurityContext';
import { useSync } from '../context/SyncContext';
import { biometricAvailability } from '../services/securityStore';
import { font, spacing } from '../theme/tokens';

export default function SecuritySettingsScreen({ navigation }) {
  const { c } = useTheme();
  const security = useSecurity();
  const { changed } = useSync();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  useEffect(() => { biometricAvailability().then((result) => setBiometricAvailable(result.available)).catch(() => setBiometricAvailable(false)); }, []);

  const setOption = async (name, value) => {
    try {
      await security.setOption(name, value);
      await changed();
    } catch (e) { Alert.alert('Security setting not changed', e.message || 'Please try again.'); }
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Title>App security</Title>
        <SectionHeader title="App lock" />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="lock-closed-outline" size={21} color={c.textMuted} />
            <View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: font.md, fontWeight: '600' }}>Require PIN to open Spendly</Text><Muted>PIN is kept in this device’s secure storage.</Muted></View>
            <Switch value={security.enabled} onValueChange={(value) => setOption('enabled', value)} trackColor={{ true: c.primary }} />
          </View>
          <Button title={security.hasPin ? 'Change PIN' : 'Set PIN'} icon="keypad-outline" variant="secondary" onPress={() => navigation.navigate('SetPin', { mode: security.hasPin ? 'change' : 'setup' })} style={{ marginTop: spacing.md }} />
          <Button title="Forgot PIN or recover access" icon="help-circle-outline" variant="secondary" onPress={() => navigation.navigate('ResetPin')} style={{ marginTop: spacing.sm }} />
        </Card>
        <SectionHeader title="Biometric unlock" />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="finger-print-outline" size={22} color={c.textMuted} />
            <View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: font.md, fontWeight: '600' }}>Use biometrics</Text><Muted>{biometricAvailable ? 'PIN remains available as a fallback.' : 'Enroll Face ID or fingerprint on this device first.'}</Muted></View>
            <Switch value={security.biometricEnabled} onValueChange={(value) => setOption('biometric', value)} disabled={!security.hasPin || (!biometricAvailable && !security.biometricEnabled)} trackColor={{ true: c.primary }} />
          </View>
        </Card>
        <SectionHeader title="Auto-lock" />
        <Card>
          <Muted style={{ marginBottom: spacing.sm }}>Lock after the app leaves the foreground</Muted>
          <Segmented value={security.timeout} onChange={(value) => setOption('timeout', value)}
            options={[{ key: 'immediate', label: 'Immediate' }, { key: '1', label: '1 minute' }, { key: '5', label: '5 minutes' }]} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
