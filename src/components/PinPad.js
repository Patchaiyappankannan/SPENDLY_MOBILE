import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { font, spacing } from '../theme/tokens';

const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'backspace']];

export default function PinPad({ value = '', onChange, length = 4, disabled = false }) {
  const { c } = useTheme();
  const digits = String(value).slice(0, length);
  const press = (key) => {
    if (disabled) return;
    if (key === 'backspace') onChange(digits.slice(0, -1));
    else if (key && digits.length < length) onChange(digits + key);
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: spacing.xl }} accessibilityLabel={`${digits.length} of ${length} PIN digits entered`}>
        {Array.from({ length }, (_, index) => <View key={index} style={{ width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: c.primary, backgroundColor: index < digits.length ? c.primary : 'transparent' }} />)}
      </View>
      {KEYS.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: 20, marginBottom: 10 }}>
          {row.map((key, index) => key ? (
            <Pressable key={key} onPress={() => press(key)} disabled={disabled} accessibilityRole="button" accessibilityLabel={key === 'backspace' ? 'Delete last digit' : `Digit ${key}`}
              style={({ pressed }) => ({ width: 72, height: 58, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surfaceAlt : c.surface, borderWidth: 1, borderColor: c.border, opacity: disabled ? 0.5 : 1 })}>
              {key === 'backspace' ? <Ionicons name="backspace-outline" size={23} color={c.text} /> : <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '600' }}>{key}</Text>}
            </Pressable>
          ) : <View key={`empty-${index}`} style={{ width: 72, height: 58 }} />)}
        </View>
      ))}
    </View>
  );
}
