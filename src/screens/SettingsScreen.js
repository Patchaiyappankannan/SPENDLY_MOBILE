import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Switch, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Screen, Title, Card, Muted, SectionHeader, Input, Button, Chip, Segmented } from '../components/ui';
import MonthSwitcher from '../components/MonthSwitcher';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { font, radius, spacing } from '../theme/tokens';
import { monthKey, timeAgo } from '../utils/format';
import { getBudget, setBudget } from '../repositories/budgetRepo';
import { getUserPreferences, updateUserPreferences } from '../repositories/preferencesRepo';
import { exportAll } from '../repositories/txRepo';
import { enableDailyReminder, cancelReminders } from '../services/notifications';
import { getLocalProfilePhoto, saveProfilePhoto, syncProfilePhoto } from '../services/profilePhoto';

const CURRENCIES = ['₹', '$', '€', '£'];

export default function SettingsScreen({ navigation }) {
  const { c, mode, setMode, currency, setCurrency } = useTheme();
  const { user, signOut, updateName } = useAuth();
  const { pending, syncing, lastSync, error, syncNow, changed } = useSync();
  const [name, setName] = useState(user?.name || '');
  const [budgetMonth, setBudgetMonth] = useState(monthKey(new Date()));
  const [budget, setBudgetText] = useState('');
  const [remind, setRemind] = useState(false);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const preferences = await getUserPreferences(user?.id);
      setRemind(preferences.dailyReminderEnabled);
      setHour(preferences.dailyReminderHour);
      setMinute(preferences.dailyReminderMinute);
    })();
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      const b = await getBudget(budgetMonth);
      if (active) setBudgetText(b ? String(b) : '');
    })();
    return () => { active = false; };
  }, [budgetMonth]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const local = await getLocalProfilePhoto();
        if (active && local) setProfilePhoto(local);
        const photo = await syncProfilePhoto();
        if (active && photo) setProfilePhoto(photo);
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  const saveName = async () => { if (name.trim() && name.trim() !== user.name) { await updateName(name.trim()); Alert.alert('Saved', 'Enter Your Full Name was updated.'); } };

  const processProfilePhoto = async (source) => {
    setPhotoBusy(true);
    try {
      let result;
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera access needed', 'Allow camera access to take a profile photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Photo access needed', 'Allow photo library access to choose a profile photo.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
      }

      if (result.canceled) return;

      const saved = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 512, height: 512 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.72, base64: true },
      );
      if (!saved.base64) throw new Error('Could not process the selected photo.');

      const photo = { data: saved.base64, mimeType: 'image/jpeg' };
      setProfilePhoto(photo);
      const synced = await saveProfilePhoto(photo);
      Alert.alert('Profile photo saved', synced
        ? 'Your photo is saved to your account and this device.'
        : 'Your photo is saved on this device and will sync when you are online.');
    } catch (e) {
      Alert.alert('Photo could not be saved', e.message || 'Please try another photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const chooseProfilePhoto = () => {
    Alert.alert('Change profile photo', 'Choose a photo source', [
      { text: 'Camera', onPress: () => processProfilePhoto('camera') },
      { text: 'Gallery', onPress: () => processProfilePhoto('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const saveBudget = async () => {
    const v = parseFloat(budget);
    if (!v || v <= 0) return Alert.alert('Enter a budget', 'Type a monthly amount greater than zero.');
    await setBudget(budgetMonth, v);
    changed();
    Alert.alert('Budget saved', 'This budget applies to the selected month.');
  };

  const toggleRemind = async (on) => {
    if (on) {
      const ok = await enableDailyReminder(hour, minute);
      if (!ok) return Alert.alert('Notifications are off', 'Allow notifications for Spendly in your phone settings.');
    } else await cancelReminders();
    setRemind(on);
    await updateUserPreferences({ dailyReminderEnabled: on }, user.id);
    changed();
  };

  const pickReminderTime = async (event, selectedTime) => {
    setShowTimePicker(false);
    if (event.type === 'dismissed' || !selectedTime) return;

    const nextHour = selectedTime.getHours();
    const nextMinute = selectedTime.getMinutes();
    setHour(nextHour);
    setMinute(nextMinute);
    await updateUserPreferences({ dailyReminderHour: nextHour, dailyReminderMinute: nextMinute }, user.id);
    changed();
    if (remind) {
      const ok = await enableDailyReminder(nextHour, nextMinute);
      if (!ok) Alert.alert('Reminder not updated', 'Allow notifications for Spendly in your phone settings.');
    }
  };

  const reminderTime = new Date();
  reminderTime.setHours(hour, minute, 0, 0);

  const exportData = async () => {
    const rows = await exportAll();
    await Share.share({ title: 'Spendly backup', message: JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, transactions: rows }, null, 2) });
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', pending
      ? `${pending} change(s) have not synced yet. They will remain on this phone under your account and sync when you sign back in.`
      : 'Your offline data will stay saved on this phone and reload when you sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);

  const Row = ({ icon, label, right }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <Ionicons name={icon} size={20} color={c.textMuted} />
      <Text style={{ flex: 1, color: c.text, fontSize: font.md }}>{label}</Text>
      {right}
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Title>Settings</Title>

        <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: radius.lg, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {profilePhoto ? (
              <Image source={{ uri: `data:${profilePhoto.mimeType};base64,${profilePhoto.data}` }} style={{ width: 52, height: 52 }} />
            ) : (
              <Text style={{ color: c.onPrimary, fontSize: font.xl, fontWeight: '700' }}>{(user?.name || '?')[0].toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '700' }}>{user?.name}</Text>
            <Muted>{user?.email}</Muted>
          </View>
        </Card>

        <SectionHeader title="Profile" />
        <Card>
          <Input label="Display name" value={name} onChangeText={setName} icon="person-outline" containerStyle={{ marginBottom: spacing.md }} />
          <Button title="Save name" variant="secondary" onPress={saveName} />
          <Button title="Change email" icon="mail-outline" variant="secondary" onPress={() => navigation.navigate('ChangeEmail')} style={{ marginTop: 10 }} />
          <Button title={profilePhoto ? 'Change profile photo' : 'Upload profile photo'} icon="image-outline"
            variant="secondary" onPress={chooseProfilePhoto} loading={photoBusy} style={{ marginTop: 10 }} />
        </Card>

        <SectionHeader title="Budget" />
        <Card>
          <MonthSwitcher month={budgetMonth} onChange={setBudgetMonth} showCalendar={false} />
          <Input label="Monthly budget" value={budget} onChangeText={(t) => setBudgetText(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad" icon="flag-outline" placeholder="e.g. 30000" containerStyle={{ marginBottom: spacing.md }} />
          <Button title="Save budget" variant="secondary" onPress={saveBudget} />
        </Card>

        <SectionHeader title="Preferences" />
        <Card>
          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Currency</Muted>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.lg }}>
            {CURRENCIES.map((x) => <Chip key={x} label={x} active={currency === x} onPress={() => setCurrency(x)} />)}
          </View>
          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Appearance</Muted>
          <Segmented value={mode} onChange={setMode}
            options={[{ key: 'system', label: 'System' }, { key: 'light', label: 'Light' }, { key: 'dark', label: 'Dark' }]} />
        </Card>

        <SectionHeader title="Planning" />
        <Card>
          <Button title="Recurring expenses" icon="repeat" variant="secondary" onPress={() => navigation.navigate('Recurring')} />
          <Button title="Bill reminders" icon="notifications-outline" variant="secondary" onPress={() => navigation.navigate('Reminders')} style={{ marginTop: 10 }} />
        </Card>

        <SectionHeader title="Security" />
        <Card>
          <Button title="App PIN and biometrics" icon="shield-checkmark-outline" variant="secondary" onPress={() => navigation.navigate('SecuritySettings')} />
        </Card>

        <SectionHeader title="Daily reminder" />
        <Card>
          <Row icon="notifications-outline" label="Remind me to log expenses"
            right={<Switch value={remind} onValueChange={toggleRemind} trackColor={{ true: c.primary }} />} />
          <Button title={`Every day at ${reminderTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
            icon="time-outline" variant="secondary" onPress={() => setShowTimePicker(true)} style={{ marginTop: spacing.md }} />
          {showTimePicker ? <DateTimePicker value={reminderTime} mode="time" display="default" onChange={pickReminderTime} /> : null}
        </Card>

        <SectionHeader title="Backup and sync" />
        <Card>
          <Row icon={pending ? 'time-outline' : 'cloud-done-outline'} label={pending ? `${pending} change(s) waiting to sync` : 'Everything is backed up'} />
          <Muted style={{ marginLeft: 32, marginBottom: spacing.md }}>Last synced: {timeAgo(lastSync)}</Muted>
          {error ? <Text style={{ color: c.expense, fontSize: font.sm, marginBottom: spacing.md }}>{error}</Text> : null}
          <Button title="Sync now" icon="sync" onPress={syncNow} loading={syncing} />
          <Button title="Export data (JSON)" icon="share-outline" variant="secondary" onPress={exportData} style={{ marginTop: 10 }} />
        </Card>

        <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} style={{ marginTop: spacing.xl }} />
        <Muted style={{ textAlign: 'center', marginTop: spacing.lg }}>Spendly 1.0.0</Muted>
      </ScrollView>
    </Screen>
  );
}
