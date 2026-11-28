import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Screen, Input, Button, Chip, Muted } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { EXPENSE_CATEGORIES } from '../constants/categories';
import { font, spacing } from '../theme/tokens';
import { friendlyDate, toDateStr } from '../utils/format';
import { getRecurring, saveRecurring } from '../repositories/recurringRepo';

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

export default function AddRecurringScreen({ navigation, route }) {
  const { c } = useTheme();
  const { changed } = useSync();
  const id = route.params?.id;
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Bills');
  const [account, setAccount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [dayOfMonth, setDayOfMonth] = useState(String(new Date().getDate()));
  const [startDate, setStartDate] = useState(toDateStr(new Date()));
  const [endDate, setEndDate] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [paidInstallments, setPaidInstallments] = useState('0');
  const [notes, setNotes] = useState('');
  const [autoAdd, setAutoAdd] = useState(true);
  const [createReminder, setCreateReminder] = useState(false);
  const [dateTarget, setDateTarget] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getRecurring(id).then((row) => {
      if (!row) return;
      setTitle(row.title); setAmount(String(row.amount)); setCategory(row.category); setAccount(row.account || '');
      setFrequency(row.frequency); setDayOfMonth(String(row.day_of_month || 1)); setStartDate(row.start_date);
      setEndDate(row.end_date || ''); setTotalInstallments(row.total_installments ? String(row.total_installments) : '');
      setPaidInstallments(String(row.paid_installments || 0)); setNotes(row.notes || '');
      setAutoAdd(!!row.auto_add); setCreateReminder(!!row.create_reminder);
    });
  }, [id]);

  const save = async () => {
    const value = Number(amount);
    const total = totalInstallments ? Number(totalInstallments) : null;
    const paid = Number(paidInstallments || 0);
    if (!title.trim()) return setError('Enter a title');
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than zero');
    if (frequency === 'monthly' && (!Number(dayOfMonth) || Number(dayOfMonth) > 31)) return setError('Day of month must be between 1 and 31');
    if (total && (!Number.isInteger(total) || total < 1 || paid > total)) return setError('Check the installment counts');
    if (endDate && endDate < startDate) return setError('End date must be on or after the start date');
    await saveRecurring({
      title, amount: value, category, account, frequency, dayOfMonth, startDate, endDate,
      totalInstallments: total, paidInstallments: paid, autoAdd, createReminder, notes,
      nextDueDate: id ? undefined : startDate,
    }, id);
    changed();
    navigation.goBack();
  };

  const dateValue = new Date(`${dateTarget === 'end' && endDate ? endDate : startDate}T12:00:00`);
  const onDateChange = (event, date) => {
    setDateTarget('');
    if (event.type === 'dismissed' || !date) return;
    const value = toDateStr(date);
    if (dateTarget === 'end') setEndDate(value); else setStartDate(value);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: 0 }}>
          <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '700' }}>{id ? 'Edit recurring rule' : 'New recurring expense'}</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="close" size={24} color={c.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Input label="Title" value={title} onChangeText={(v) => { setTitle(v); setError(''); }} placeholder="Rent, Netflix, car EMI" maxLength={100} />
          <Input label="Amount" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Category</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg }}>
            {EXPENSE_CATEGORIES.map((item) => <Chip key={item.key} label={item.key} icon={item.icon} color={item.color} active={category === item.key} onPress={() => setCategory(item.key)} />)}
          </View>
          <Input label="Account / payment mode" value={account} onChangeText={setAccount} placeholder="Cash, bank, credit card" maxLength={80} />
          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Frequency</Muted>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.lg }}>
            {FREQUENCIES.map((item) => <Chip key={item} label={item[0].toUpperCase() + item.slice(1)} active={frequency === item} onPress={() => setFrequency(item)} />)}
          </View>
          {frequency === 'monthly' ? <Input label="Day of month (1-31)" value={dayOfMonth} onChangeText={(v) => setDayOfMonth(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" /> : null}
          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Start date</Muted>
          <Button title={friendlyDate(startDate)} icon="calendar-outline" variant="secondary" onPress={() => setDateTarget('start')} style={{ marginBottom: spacing.md }} />
          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Optional end date</Muted>
          <Button title={endDate ? friendlyDate(endDate) : 'No end date'} icon="calendar-outline" variant="secondary" onPress={() => setDateTarget('end')} style={{ marginBottom: spacing.lg }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Input containerStyle={{ flex: 1 }} label="Total installments" value={totalInstallments} onChangeText={(v) => setTotalInstallments(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Optional" />
            <Input containerStyle={{ flex: 1 }} label="Already paid" value={paidInstallments} onChangeText={(v) => setPaidInstallments(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          </View>
          <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional details" maxLength={300} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
            <View style={{ flex: 1, paddingRight: 12 }}><Text style={{ color: c.text, fontWeight: '600' }}>Auto-add expense</Text><Muted>Turn off to confirm each due entry</Muted></View>
            <Switch value={autoAdd} onValueChange={setAutoAdd} trackColor={{ true: c.primary }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: spacing.md }}>
            <View style={{ flex: 1, paddingRight: 12 }}><Text style={{ color: c.text, fontWeight: '600' }}>Create due reminder</Text><Muted>Make a local alert before each due date</Muted></View>
            <Switch value={createReminder} onValueChange={setCreateReminder} trackColor={{ true: c.primary }} />
          </View>
          {error ? <Text style={{ color: c.expense, marginBottom: 10 }}>{error}</Text> : null}
          <Button title={id ? 'Save future changes' : 'Create rule'} onPress={save} />
        </ScrollView>
        {dateTarget ? <DateTimePicker value={dateValue} mode="date" display="default" onChange={onDateChange} /> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}