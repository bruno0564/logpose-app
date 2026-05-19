import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

export default function SettingsScreen() {
  const { theme: t, dark, toggleTheme } = useTheme()
  const { lang, setLang, t: tr } = useLang()
  const s = makeStyles(t)

  return (
    <View style={s.screen}>
      <Text style={s.title}>{tr('settings.title')}</Text>

      <View style={s.section}>
        <View style={s.row}>
          <View>
            <Text style={s.rowLabel}>{tr('settings.darkMode')}</Text>
            <Text style={s.rowSub}>{tr('settings.darkModeDesc')}</Text>
          </View>
          <Switch
            value={dark}
            onValueChange={toggleTheme}
            trackColor={{ false: t.border2, true: t.accent }}
            thumbColor={t.text}
          />
        </View>

        <View style={s.divider} />

        <View style={s.row}>
          <View>
            <Text style={s.rowLabel}>{tr('settings.language')}</Text>
            <Text style={s.rowSub}>{tr('settings.languageDesc')}</Text>
          </View>
          <View style={s.langPicker}>
            <TouchableOpacity
              style={[s.langBtn, lang === 'en' && s.langBtnActive]}
              onPress={() => setLang('en')}
            >
              <Text style={[s.langBtnText, lang === 'en' && s.langBtnTextActive]}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.langBtn, lang === 'es' && s.langBtnActive]}
              onPress={() => setLang('es')}
            >
              <Text style={[s.langBtnText, lang === 'es' && s.langBtnTextActive]}>ES</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )
}

const makeStyles = (t) => StyleSheet.create({
  screen:          { flex: 1, backgroundColor: t.bg, padding: 16, paddingTop: 54 },
  title:           { color: t.text, fontSize: 22, fontWeight: '700', marginBottom: 28 },
  section:         { backgroundColor: t.surface, borderRadius: 10, borderWidth: 1, borderColor: t.border },
  row:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLabel:        { color: t.text, fontSize: 15, fontWeight: '500' },
  rowSub:          { color: t.text3, fontSize: 12, marginTop: 2 },
  divider:         { height: 1, backgroundColor: t.border, marginHorizontal: 16 },
  langPicker:      { flexDirection: 'row', backgroundColor: t.surface2, borderRadius: 8, padding: 3, gap: 3 },
  langBtn:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  langBtnActive:   { backgroundColor: t.accent },
  langBtnText:     { color: t.text3, fontSize: 13, fontWeight: '600' },
  langBtnTextActive: { color: t.text },
})
