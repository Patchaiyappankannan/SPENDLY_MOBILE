import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Segmented, Chip, Input, Button, Muted } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, radius, spacing } from '../theme/tokens';
import { categoriesFor } from '../constants/categories';
import { toDateStr, shiftDay, friendlyDate } from '../utils/format';
import { addTx, updateTx, deleteTx, getTx } from '../repositories/txRepo';

export default function AddTransactionScreen({ navigation, route }) {
  const { c, currency } = useTheme();
  const { changed } = useSync();
  const id = route.params?.id;
  const today = toDateStr(new Date());
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [incomeFrequency, setIncomeFrequency] = useState('monthly');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const t = await getTx(id);
      if (!t) return;
      setType(t.type); setAmount(String(t.amount)); setCategory(t.category); setNote(t.note || ''); setDate(t.date);
      setIncomeFrequency(t.income_frequency || 'monthly');
    })();
  }, [id]);

  const switchType = (t) => {
    setType(t);
    if (!categoriesFor(t).some((x) => x.key === category)) setCategory(categoriesFor(t)[0].key);
  };

  const save = async () => {
    const a = parseFloat(amount);
    if (!a || a <= 0) return setError('Enter an amount greater than zero');
    const payload = {
      type, amount: a, category, note: note.trim(), date,
      incomeFrequency: type === 'income' && category === 'Salary' ? incomeFrequency : null,
    };
    if (id) await updateTx(id, payload); else await addTx(payload);
    changed();
    navigation.goBack();
  };

  const remove = () =>
    Alert.alert('Delete this entry?', 'It will also be removed from your backup.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTx(id); changed(); navigation.goBack(); } },
    ]);

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: 0 }}>
          <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '700' }}>{id ? 'Edit entry' : 'New entry'}</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="close" size={26} color={c.text} /></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Segmented value={type} onChange={switchType} options={[{ key: 'expense', label: 'Expense' }, { key: 'income', label: 'Income' }]} />

          <View style={{ alignItems: 'center', marginVertical: 28 }}>
            <Muted>Amount</Muted>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: type === 'income' ? c.income : c.text, fontSize: 36, fontWeight: '700', marginRight: 6 }}>{currency}</Text>
              <TextInput
                value={amount} onChangeText={(t) => { setAmount(t.replace(/[^0-9.]/g, '')); setError(''); }}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textMuted} autoFocus={!id}
                style={{ color: type === 'income' ? c.income : c.text, fontSize: 44, fontWeight: '800', minWidth: 80, textAlign: 'center' }}
              />
            </View>
            {error ? <Text style={{ color: c.expense, fontSize: font.sm, marginTop: 6 }}>{error}</Text> : null}
          </View>

          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Category</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.xl }}>
            {categoriesFor(type).map((x) => (
              <Chip key={x.key} label={x.key} icon={x.icon} color={x.color} active={category === x.key} onPress={() => setCategory(x.key)} />
            ))}
          </View>

          {type === 'income' && category === 'Salary' ? (
            <>
              <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Salary frequency</Muted>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.xl }}>
                {['daily', 'weekly', 'monthly'].map((frequency) => (
                  <Chip key={frequency} label={frequency[0].toUpperCase() + frequency.slice(1)}
                    active={incomeFrequency === frequency} onPress={() => setIncomeFrequency(frequency)} />
                ))}
              </View>
            </>
          ) : null}

          <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Date</Muted>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface,
            borderWidth: 1, borderColor: c.border, borderRadius: radius.md, height: 50, paddingHorizontal: 8, marginBottom: spacing.lg,
          }}>
            <Pressable onPress={() => setDate(shiftDay(date, -1))} hitSlop={10} style={{ padding: 8 }}><Ionicons name="chevron-back" size={20} color={c.text} /></Pressable>
            <Pressable onPress={() => setDate(today)}>
              <Text style={{ color: c.text, fontSize: font.md, fontWeight: '600' }}>{friendlyDate(date)}  ({date})</Text>
            </Pressable>
            <Pressable onPress={() => date < today && setDate(shiftDay(date, 1))} hitSlop={10} style={{ padding: 8, opacity: date < today ? 1 : 0.3 }}>
              <Ionicons name="chevron-forward" size={20} color={c.text} />
            </Pressable>
          </View>

          <Input label="Note (optional)" icon="create-outline" value={note} onChangeText={setNote} placeholder="e.g. Lunch with team" maxLength={120} />

          <Button title={id ? 'Save changes' : 'Save entry'} onPress={save} />
          {id ? <Button title="Delete entry" variant="danger" onPress={remove} style={{ marginTop: 10 }} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
