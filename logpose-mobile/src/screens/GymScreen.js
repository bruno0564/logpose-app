import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function GymScreen() {
  return (
    <View style={s.container}>
      <Ionicons name="barbell-outline" color="#333" size={48} />
      <Text style={s.title}>Gym</Text>
      <Text style={s.sub}>Próximamente</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', alignItems: 'center', justifyContent: 'center', gap: 12 },
  title:     { color: '#444', fontSize: 22, fontWeight: '700' },
  sub:       { color: '#333', fontSize: 14 },
})
