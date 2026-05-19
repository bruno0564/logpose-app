import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../ThemeContext'

export default function GradientButton({ onPress, label, disabled, loading, style }) {
  const { theme: t } = useTheme()
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.8} style={style}>
      <LinearGradient
        colors={disabled || loading ? ['#555', '#555'] : t.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.label}>{label}</Text>
        }
      </LinearGradient>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})
