import { View, Text, Switch, StyleSheet } from 'react-native'
import { useTheme } from '../ThemeContext'

export default function SettingsScreen() {
  const { theme: t, dark, toggleTheme } = useTheme()
  const s = makeStyles(t)

  return (
    <View style={s.screen}>
      <Text style={s.title}>Ajustes</Text>

      <View style={s.section}>
        <View style={s.row}>
          <View>
            <Text style={s.rowLabel}>Modo oscuro</Text>
            <Text style={s.rowSub}>Cambia el aspecto de la app</Text>
          </View>
          <Switch
            value={dark}
            onValueChange={toggleTheme}
            trackColor={{ false: t.border2, true: t.accent }}
            thumbColor={t.text}
          />
        </View>
      </View>
    </View>
  )
}

const makeStyles = (t) => StyleSheet.create({
  screen:    { flex: 1, backgroundColor: t.bg, padding: 16, paddingTop: 54 },
  title:     { color: t.text, fontSize: 22, fontWeight: '700', marginBottom: 28 },
  section:   { backgroundColor: t.surface, borderRadius: 10, borderWidth: 1, borderColor: t.border },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLabel:  { color: t.text, fontSize: 15, fontWeight: '500' },
  rowSub:    { color: t.text3, fontSize: 12, marginTop: 2 },
})
