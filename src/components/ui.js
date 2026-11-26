import React from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, font, shadow } from '../theme/tokens';

export function Screen({ children, style, edges = ['top'] }) {
  const { c } = useTheme();
  return <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</SafeAreaView>;
}

export function Card({ children, style }) {
  const { c, dark } = useTheme();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
      borderWidth: dark ? 1 : 0, borderColor: c.border }, shadow(dark), style]}>
      {children}
    </View>
  );
}

export function Title({ children, style }) {
  const { c } = useTheme();
  return <Text style={[{ color: c.text, fontSize: font.xl, fontWeight: '700' }, style]}>{children}</Text>;
}

export function Muted({ children, style, ...p }) {
  const { c } = useTheme();
  return <Text style={[{ color: c.textMuted, fontSize: font.sm }, style]} {...p}>{children}</Text>;
}

export function SectionHeader({ title, action, onAction }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm }}>
      <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '700' }}>{title}</Text>
      {action ? <Pressable onPress={onAction} hitSlop={8}><Text style={{ color: c.primary, fontSize: font.sm, fontWeight: '600' }}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style }) {
  const { c } = useTheme();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.expenseSoft : variant === 'secondary' ? c.primarySoft : 'transparent';
  const fg = variant === 'primary' ? c.onPrimary : variant === 'danger' ? c.expense : c.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{
        backgroundColor: bg, height: 50, borderRadius: radius.md, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: font.md, fontWeight: '600' }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Input({ label, icon, error, rightIcon, onRightIconPress, rightIconLabel, style, containerStyle, ...props }) {
  const { c } = useTheme();
  return (
    <View style={[{ marginBottom: spacing.lg }, containerStyle]}>
      {label ? <Text style={{ color: c.textMuted, fontSize: font.sm, fontWeight: '600', marginBottom: 6 }}>{label}</Text> : null}
      <View style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderColor: error ? c.expense : c.border,
        borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, height: 50,
      }}>
        {icon ? <Ionicons name={icon} size={18} color={c.textMuted} style={{ marginRight: 8 }} /> : null}
        <TextInput placeholderTextColor={c.textMuted} style={[{ flex: 1, color: c.text, fontSize: font.md }, style]} {...props} />
        {rightIcon ? (
          <Pressable onPress={onRightIconPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={rightIconLabel}
            style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={rightIcon} size={20} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={{ color: c.expense, fontSize: font.xs, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, icon, color, active, onPress }) {
  const { c } = useTheme();
  const tint = color || c.primary;
  return (
    <Pressable onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: radius.pill,
      backgroundColor: active ? tint : c.surface, borderWidth: 1, borderColor: active ? tint : c.border,
    }}>
      {icon ? <Ionicons name={icon} size={16} color={active ? '#fff' : tint} /> : null}
      <Text style={{ color: active ? '#fff' : c.text, fontSize: font.sm, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented({ options, value, onChange, style }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: 3 }, style]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={{
            flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 1,
            backgroundColor: on ? c.surface : 'transparent',
          }}>
            <Text style={{ color: on ? c.text : c.textMuted, fontSize: font.sm, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ pct, color, height = 8 }) {
  const { c } = useTheme();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color || c.primary, borderRadius: height }} />
    </View>
  );
}

export function IconBadge({ name, color, size = 40 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.4, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.5} color={color} />
    </View>
  );
}

export function EmptyState({ icon = 'receipt-outline', title, hint, actionTitle, onAction }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 }}>
      <Ionicons name={icon} size={40} color={c.textMuted} />
      <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '700', marginTop: 12 }}>{title}</Text>
      {hint ? <Text style={{ color: c.textMuted, fontSize: font.sm, marginTop: 4, textAlign: 'center' }}>{hint}</Text> : null}
      {actionTitle ? <Button title={actionTitle} onPress={onAction} variant="secondary" style={{ marginTop: 16, paddingHorizontal: 20 }} /> : null}
    </View>
  );
}

export function FAB({ onPress }) {
  const { c, dark } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{
      position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 18,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.9 : 1,
    }, shadow(dark), { elevation: 5 }]}>
      <Ionicons name="add" size={28} color={c.onPrimary} />
    </Pressable>
  );
}
