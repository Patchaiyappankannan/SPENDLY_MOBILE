import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { font, spacing } from '../theme/tokens';
import { catMeta } from '../constants/categories';
import { formatMoney, friendlyDate } from '../utils/format';
import { IconBadge } from './ui';

export default function TxRow({ item, onPress, showDate }) {
  const { c, currency } = useTheme();
  const meta = catMeta(item.type, item.category);
  const isIncome = item.type === 'income';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: spacing.md, opacity: pressed ? 0.7 : 1,
    })}>
      <IconBadge name={meta.icon} color={meta.color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: font.md, fontWeight: '600' }} numberOfLines={1}>{item.category}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {item.sync_status === 'pending' ? <Ionicons name="time-outline" size={12} color={c.accent} /> : null}
          <Text style={{ color: c.textMuted, fontSize: font.xs }} numberOfLines={1}>
            {[item.note, item.income_frequency ? `${item.income_frequency} salary` : null, showDate ? friendlyDate(item.date) : null]
              .filter(Boolean).join('  ·  ') || (item.sync_status === 'pending' ? 'Waiting to sync' : ' ')}
          </Text>
        </View>
      </View>
      <Text style={{ color: isIncome ? c.income : c.text, fontSize: font.md, fontWeight: '700' }}>
        {isIncome ? '+' : '-'}{formatMoney(item.amount, currency)}
      </Text>
    </Pressable>
  );
}
