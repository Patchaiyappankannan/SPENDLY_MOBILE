import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from './AuthContext';
import { useSync } from './SyncContext';
import { biometricAvailability, clearPinFailures, getSecuritySettings, savePin, setSecurityOption, verifyPin } from '../services/securityStore';
import { applyServerPreferences, hasUserPreferences } from '../repositories/preferencesRepo';
import { request } from '../services/api';

const Ctx = createContext(null);
const initial = { ready: false, userId: null, hasPin: false, enabled: false, biometricEnabled: false, timeout: 'immediate', pinLength: 4, locked: false, needsPinSetup: false };
const timeoutMs = (value) => value === 'immediate' ? 0 : Number(value) * 60 * 1000;

async function loadSecuritySettings(userId) {
  if (!(await hasUserPreferences(userId))) {
    try {
      const result = await request('/preferences/sync', { timeout: 5000 });
      if (result.preference) await applyServerPreferences(result.preference);
    } catch {}
  }
  return getSecuritySettings(userId);
}

export function SecurityProvider({ children }) {
  const { user } = useAuth();
  const { version } = useSync();
  const uid = user?.id == null ? null : String(user.id);
  const [security, setSecurity] = useState(initial);

  const refresh = useCallback(async () => {
    if (!uid) {
      setSecurity({ ...initial, ready: true });
      return;
    }
    const stored = await getSecuritySettings(uid);
    setSecurity((current) => ({
      ...stored,
      ready: true,
      userId: uid,
      locked: current.userId === uid ? current.locked && stored.enabled : stored.enabled && stored.hasPin,
      needsPinSetup: !stored.hasPin,
    }));
  }, [uid]);

  useEffect(() => {
    let mounted = true;
    if (!uid) {
      setSecurity({ ...initial, ready: true });
      return () => { mounted = false; };
    }
    setSecurity((current) => ({ ...current, ready: false, userId: uid }));
    loadSecuritySettings(uid).then((stored) => {
      if (!mounted) return;
      setSecurity({
        ...stored, ready: true, userId: uid,
        locked: stored.enabled && stored.hasPin,
        needsPinSetup: !stored.hasPin,
      });
    }).catch(() => {
      if (mounted) setSecurity({ ...initial, ready: true, userId: uid, needsPinSetup: true });
    });
    return () => { mounted = false; };
  }, [uid]);

  useEffect(() => {
    if (!uid || !security.ready || security.userId !== uid) return undefined;
    let active = true;
    getSecuritySettings(uid).then((stored) => {
      if (!active) return;
      setSecurity((current) => {
        const justEnabled = !current.enabled && stored.enabled;
        return {
          ...stored,
          ready: true,
          userId: uid,
          locked: stored.enabled && stored.hasPin && (current.locked || justEnabled),
          needsPinSetup: !stored.hasPin,
        };
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [uid, version]);

  const lock = useCallback(() => {
    setSecurity((current) => current.enabled && current.hasPin ? { ...current, locked: true } : current);
  }, []);

  const installPin = useCallback(async (pin) => {
    if (!uid) throw new Error('Sign in before setting an app PIN.');
    await savePin(uid, pin);
    const stored = await getSecuritySettings(uid);
    setSecurity({ ...stored, ready: true, userId: uid, locked: false, needsPinSetup: false });
  }, [uid]);

  const unlockWithPin = useCallback(async (pin) => {
    if (!uid) return { ok: false };
    const result = await verifyPin(uid, pin);
    if (result.ok) setSecurity((current) => ({ ...current, locked: false }));
    return result;
  }, [uid]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!uid || !security.biometricEnabled) return { success: false, error: 'Biometric unlock is disabled.' };
    const available = await biometricAvailability();
    if (!available.available) return { success: false, error: 'No enrolled biometric is available on this device.' };
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Spendly',
      cancelLabel: 'Use PIN',
      fallbackLabel: 'Use device passcode',
    });
    if (result.success) {
      await clearPinFailures(uid);
      setSecurity((current) => ({ ...current, locked: false }));
    }
    return result;
  }, [security.biometricEnabled, uid]);

  const setOption = useCallback(async (name, value) => {
    if (!uid) return;
    if (name === 'enabled' && value && !security.hasPin) throw new Error('Set a PIN before enabling app lock.');
    if (name === 'biometric' && value) {
      const available = await biometricAvailability();
      if (!available.available) throw new Error('Set up Face ID or fingerprint on this device first.');
    }
    await setSecurityOption(uid, name, value);
    setSecurity((current) => ({ ...current, [name === 'biometric' ? 'biometricEnabled' : name]: value }));
  }, [security.hasPin, uid]);

  useEffect(() => {
    let previousState = AppState.currentState;
    let backgroundAt = null;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        if (backgroundAt != null && security.enabled && security.hasPin && Date.now() - backgroundAt >= timeoutMs(security.timeout)) lock();
        backgroundAt = null;
      } else if (previousState === 'active' && backgroundAt == null) {
        backgroundAt = Date.now();
        if (security.enabled && security.hasPin && security.timeout === 'immediate') lock();
      }
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [lock, security.enabled, security.hasPin, security.timeout]);

  return <Ctx.Provider value={{ ...security, refresh, lock, installPin, unlockWithPin, unlockWithBiometrics, setOption }}>{children}</Ctx.Provider>;
}

export const useSecurity = () => useContext(Ctx);
