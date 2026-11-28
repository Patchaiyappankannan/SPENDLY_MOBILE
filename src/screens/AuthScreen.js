import React, { useEffect, useState } from 'react';
import { View, Text, Image, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { Screen, Input, Button, Muted } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { font, radius } from '../theme/tokens';

export default function AuthScreen({ navigation, route }) {
  const { c } = useTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';

  useEffect(() => {
    if (!route.params?.successMessage) return;
    setNotice(route.params.successMessage);
    navigation.setParams({ successMessage: undefined });
  }, [navigation, route.params?.successMessage]);

  const submit = async () => {
    setError('');
    if (register && !name.trim()) return setError('Enter Enter Your Full Name');
    if (!email.trim() || !password) return setError('Enter your email and password');
    if (register && password.length < 6) return setError('Password must be at least 6 characters');
    setBusy(true);
    try {
      if (register) await signUp(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Image source={require('../../assets/logo.png')} style={{ width: 64, height: 64 }} />
            <Text style={{ color: c.text, fontSize: font.xxl, fontWeight: '800', marginTop: 20, textAlign: 'center' }}>Spendly</Text>
            <Muted style={{ fontSize: font.md, marginTop: 4, textAlign: 'center' }}>
              {register ? 'Create an account to back up your expenses.' : 'Sign in to pick up where you left off.'}
            </Muted>
          </View>

          {register ? <Input label="Name" icon="person-outline" value={name} onChangeText={setName} placeholder="Enter Your Full Name" /> : null}
          <Input label="Email" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="Enter Your Email "
            autoCapitalize="none" keyboardType="email-address" />
          <Input label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword}
            placeholder={register ? 'At least 6 characters' : 'Enter Your Password'} secureTextEntry={!passwordVisible}
            rightIcon={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
            rightIconLabel={passwordVisible ? 'Hide password' : 'Show password'}
            onRightIconPress={() => setPasswordVisible((visible) => !visible)} />

          {notice ? <Text style={{ color: c.income, fontSize: font.sm, marginBottom: 12 }}>{notice}</Text> : null}
          {error ? <Text style={{ color: c.expense, fontSize: font.sm, marginBottom: 12 }}>{error}</Text> : null}
          <Button title={register ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />
          {!register ? <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'center', padding: 12 }}>
            <Text style={{ color: c.primary, fontSize: font.sm, fontWeight: '600' }}>Forgot password?</Text>
          </Pressable> : null}
          <Button
            title={register ? 'I already have an account' : 'Create a new account'}
            variant="ghost" style={{ marginTop: 8 }}
            onPress={() => { setMode(register ? 'login' : 'register'); setError(''); }}
          />
          <Muted style={{ textAlign: 'center', marginTop: 20 }}>
            Internet is needed only to sign in. After that, everything works offline and syncs later.
          </Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
