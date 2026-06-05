import { StyleSheet, ActivityIndicator } from 'react-native'
import Text from './Text'
import PressableScale from './PressableScale'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../ThemeContext'

export default function GradientButton({ onPress, label, disabled, loading, style }) {
  const { theme: t } = useTheme()
  return (
    <PressableScale onPress={onPress} disabled={disabled || loading} style={style}>
      <LinearGradient
        colors={disabled || loading ? ['#555', '#555'] : t.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, t.cartoon && { borderWidth: 3, borderColor: t.text }]}
      >
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={[styles.label, { fontFamily: t.fontTitle }]}>{label}</Text>
        }
      </LinearGradient>
    </PressableScale>
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
