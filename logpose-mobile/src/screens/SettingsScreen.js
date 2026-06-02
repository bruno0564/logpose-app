import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'
import FadeInView from '../components/FadeInView'

const STYLES = [
  { id: 'normal',  label: 'Normal',  bg: '#111111', surface: '#1e1e1e', accent: '#818cf8', text: '#f0f0f0' },
  { id: 'cuphead', label: 'Cuphead', bg: '#f0d9a0', surface: '#faecc8', accent: '#c01818', text: '#180800' },
]

export default function SettingsScreen() {
  const { theme: t, dark, toggleTheme, appStyle, setAppStyle } = useTheme()
  const { lang, setLang, t: tr } = useLang()
  const s = makeStyles(t)

  return (
    <FadeInView style={s.screen}>
      <Text style={s.title}>{tr('settings.title')}</Text>

      <View style={s.section}>
        <View style={[s.row, s.rowColumn]}>
          <View>
            <Text style={s.rowLabel}>{tr('settings.style')}</Text>
            <Text style={s.rowSub}>{tr('settings.styleDesc')}</Text>
          </View>
          <View style={s.stylePicker}>
            {STYLES.map(st => {
              const selected = appStyle === st.id
              return (
                <TouchableOpacity
                  key={st.id}
                  activeOpacity={0.85}
                  onPress={() => setAppStyle(st.id)}
                  style={[s.styleCard, { backgroundColor: st.bg, borderColor: selected ? st.accent : 'transparent' }]}
                >
                  <View style={[s.stylePreview, { backgroundColor: st.surface, borderColor: st.accent + '55' }]}>
                    <View style={[s.stylePreviewBar, { backgroundColor: st.accent }]} />
                  </View>
                  <Text style={[s.styleLabel, { color: st.text }]}>{st.label}</Text>
                  {selected && (
                    <View style={[s.styleCheck, { backgroundColor: st.accent }]}>
                      <Text style={[s.styleCheckMark, { color: st.bg }]}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {appStyle === 'normal' && (
          <>
            <View style={s.divider} />
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
          </>
        )}

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
    </FadeInView>
  )
}

const makeStyles = (t) => StyleSheet.create({
  screen:          { flex: 1, backgroundColor: t.bg, padding: 16, paddingTop: 54 },
  title:           { color: t.cartoon ? t.accent : t.text, fontSize: 22, fontWeight: '700', marginBottom: 28, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', letterSpacing: t.cartoon ? 1 : 0 },
  section:         { backgroundColor: t.surface, borderRadius: t.cartoon ? 14 : 10, borderWidth: t.cardBorderWidth, borderColor: t.cardBorderColor, ...(t.cartoon ? t.shadow : {}) },
  row:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowColumn:       { flexDirection: 'column', alignItems: 'flex-start', gap: 12 },
  rowLabel:        { color: t.text, fontSize: 15, fontWeight: '500' },
  rowSub:          { color: t.text3, fontSize: 12, marginTop: 2 },
  divider:         { height: 1, backgroundColor: t.border, marginHorizontal: 16 },
  langPicker:      { flexDirection: 'row', backgroundColor: t.surface2, borderRadius: 8, padding: 3, gap: 3 },
  langBtn:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  langBtnActive:   { backgroundColor: t.accent },
  langBtnText:     { color: t.text3, fontSize: 13, fontWeight: '600' },
  langBtnTextActive: { color: t.cartoon ? t.bg : t.text },
  stylePicker:     { flexDirection: 'row', gap: 10, width: '100%' },
  styleCard:       { flex: 1, borderWidth: 2, borderRadius: 10, padding: 10, alignItems: 'center', gap: 8, position: 'relative' },
  stylePreview:    { width: '100%', height: 30, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stylePreviewBar: { width: '55%', height: 6, borderRadius: 3 },
  styleLabel:      { fontSize: 12, fontWeight: '700', fontFamily: t.fontTitle },
  styleCheck:      { position: 'absolute', top: 5, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  styleCheckMark:  { fontSize: 10, fontWeight: '700' },
})
