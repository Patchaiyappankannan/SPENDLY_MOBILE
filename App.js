import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import './src/services/notifications';
import { getDb } from './src/db';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SyncProvider } from './src/context/SyncContext';
import { SecurityProvider, useSecurity } from './src/context/SecurityContext';
import RootNavigator from './src/navigation/RootNavigator';
import SetPinScreen from './src/screens/SetPinScreen';
import UnlockScreen from './src/screens/UnlockScreen';
import ResetPinScreen from './src/screens/ResetPinScreen';

function BrandSplash() {
  return (
    <View style={{ flex: 1, backgroundColor: '#14213D', alignItems: 'center', justifyContent: 'center' }}>
      <Image source={require('./assets/splash-icon.png')} resizeMode="contain" style={{ width: 144, height: 144 }} />
      <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 16 }}>Spendly</Text>
    </View>
  );
}

function Root() {
  const { c, dark } = useTheme();
  const { loading, user } = useAuth();
  const security = useSecurity();
  const [recoveringPin, setRecoveringPin] = useState(false);
  const expectedUserId = user?.id == null ? null : String(user.id);
  const securityReady = security.ready && security.userId === expectedUserId;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {loading || !securityReady ? (
        <BrandSplash />
      ) : user && security.needsPinSetup ? (
        <SetPinScreen />
      ) : user && security.locked && recoveringPin ? (
        <ResetPinScreen onComplete={() => setRecoveringPin(false)} />
      ) : user && security.locked ? (
        <UnlockScreen onForgotPin={() => setRecoveringPin(true)} />
      ) : (
        <RootNavigator />
      )}
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    getDb().then(() => setReady(true)).catch((e) => setErr(String(e)));
  }, []);

  if (!ready) {
    return (
      err ? (
        <View style={{ flex: 1, backgroundColor: '#14213D', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#FFFFFF' }}>Could not open the local database: {err}</Text>
        </View>
      ) : <BrandSplash />
    );
  }
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SyncProvider>
            <SecurityProvider>
              <Root />
            </SecurityProvider>
          </SyncProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
