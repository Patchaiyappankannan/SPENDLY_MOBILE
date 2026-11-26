import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import './src/services/notifications';
import { getDb } from './src/db';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SyncProvider } from './src/context/SyncContext';
import RootNavigator from './src/navigation/RootNavigator';

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
  const { loading } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {loading ? (
        <BrandSplash />
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
            <Root />
          </SyncProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
