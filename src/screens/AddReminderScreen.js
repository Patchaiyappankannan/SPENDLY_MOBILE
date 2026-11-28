import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Screen, Input, Button, Chip, Muted } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';
import { friendlyDate, toDateStr } from '../utils/format';
import { getReminder, saveReminder } from '../repositories/reminderRepo';
import { listRecurring } from '../repositories/recurringRepo';

const TYPES = [
  { key: 'bill', label: 'Bill' }, { key: 'emi', label: 'EMI' },
  { key: 'credit_card', label: 'Credit card' }, { key: 'other', label: 'Other' },
];

export default function AddReminderScreen({ navigation, route }) {
  const { c } = useTheme();
  const { changed } = useSync();
  const id = route.params?.id;
  const [title, setTitle] = useState('');
  const [type, setType] = useState('bill');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(toDateStr(new Date()));
  const [repeatType, setRepeatType] = useState('none');
  const [remindBeforeDays, setRemindBeforeDays] = useState(0);
  const [notifyTime, setNotifyTime] = useState('09:00');
  const [account, setAccount] = useState('');
  const [recurringId, setRecurringId] = useState('');
  const [rules, setRules] = useState([]);
  const [picker, setPicker] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listRecurring({ active: true }).then(setRules);
    if (!id) return;
    getReminder(id).then((row) => {
      if (!row) return;
      setTitle(row.title); setType(row.type); setAmount(row.amount == null ? '' : String(row.amount));
      setDueDate(row.due_date); setRepeatType(row.repeat_type); setRemindBeforeDays(row.remind_before_days);
      setNotifyTime(row.notify_time); setAccount(row.account || ''); setRecurringId(row.recurring_id || '');
    });
  }, [id]);

  const save = async () => {
    if (!title.trim()) return setError('Enter a title');
    if (amount && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) return setError('Amount must be greater than zero');
    await saveReminder({ title, type, amount, dueDate, repeatType, remindBeforeDays, notifyTime, account, recurringId }, id);
    changed();
    navigation.goBack();
  };

  const timeDate = new Date();
  const [hour, minute] = notifyTime.split(':').map(Number);
  timeDate.setHours(hour, minute, 0, 0);
  const onPicker = (event, selected) => {
    const target = picker;
    setPicker('');
    if (event.type === 'dismissed' || !selected) return;
    if (target === 'date') setDueDate(toDateStr(selected));
    else setNotifyTime(`${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`);
  };

  const chooseRule = () => Alert.alert('Linked recurring rule', 'Choose a rule for this reminder.', [
    { text: 'No linked rule', onPress: () => setRecurringId('') },
    ...rules.slice(0, 4).map((rule) => ({ text: rule.title, onPress: () => setRecurringId(rule.id) })),
    { text: 'Cancel', style: 'cancel' },
  ]);
  const linkedTitle = rules.find((rule) => rule.id === recurringId)?.title || 'None';

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: 0 }}>
          <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '700' }}>{id ? 'Edit reminder' : 'New reminder'}</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="close" size={24} color={c.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Input label="Title" value={title} onChangeText={setTitle} placeholder="Electricity bill, card payment" maxLength={100} />
          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Type</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg }}>
            {TYPES.map((item) => <Chip key={item.key} label={item.label} active={type === item.key} onPress={() => setType(item.key)} />)}
          </View>
          <Input label="Amount (optional)" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Due date</Muted>
          <Button title={friendlyDate(dueDate)} icon="calendar-outline" variant="secondary" onPress={() => setPicker('date')} style={{ marginBottom: spacing.lg }} />
          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Repeat</Muted>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.lg }}>
            {['none', 'monthly', 'yearly'].map((value) => <Chip key={value} label={value[0].toUpperCase() + value.slice(1)} active={repeatType === value} onPress={() => setRepeatType(value)} />)}
          </View>
          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Remind before</Muted>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.lg }}>
            {[0, 1, 3, 7].map((days) => <Chip key={days} label={days ? `${days} day${days > 1 ? 's' : ''}` : 'Same day'} active={remindBeforeDays === days} onPress={() => setRemindBeforeDays(days)} />)}
          </View>
          <Button title={`Notification time · ${notifyTime}`} icon="time-outline" variant="secondary" onPress={() => setPicker('time')} style={{ marginBottom: spacing.lg }} />
          <Input label="Linked account / card" value={account} onChangeText={setAccount} placeholder="Optional" maxLength={80} />
          <Button title={`Recurring rule · ${linkedTitle}`} icon="repeat" variant="secondary" onPress={chooseRule} style={{ marginBottom: spacing.md }} />
          {error ? <Text style={{ color: c.expense, marginBottom: 10 }}>{error}</Text> : null}
          <Button title={id ? 'Save reminder' : 'Create reminder'} onPress={save} />
        </ScrollView>
        {picker ? <DateTimePicker value={picker === 'date' ? new Date(`${dueDate}T12:00:00`) : timeDate} mode={picker} display="default" onChange={onPicker} /> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}