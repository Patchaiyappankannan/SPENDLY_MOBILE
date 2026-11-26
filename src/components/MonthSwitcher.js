import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { font, radius } from '../theme/tokens';
import { monthLabel, shiftMonth, monthKey } from '../utils/format';

export default function MonthSwitcher({ month, onChange }) {
  const { c } = useTheme();
  const isCurrent = month === monthKey(new Date());
  const Btn = ({ name, onPress, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={{
      width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1,
    }}>
      <Ionicons name={name} size={18} color={c.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 }}>
      <Btn name="chevron-back" onPress={() => onChange(shiftMonth(month, -1))} />
      <Pressable onPress={() => onChange(monthKey(new Date()))}>
        <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '700' }}>{monthLabel(month)}</Text>
      </Pressable>
      <Btn name="chevron-forward" onPress={() => onChange(shiftMonth(month, 1))} disabled={isCurrent} />
    </View>
  );
}
