import { useState, useEffect } from 'react'
import { View, Switch, TouchableOpacity, StyleSheet, Share } from 'react-native'
import Text from '../components/Text'
import TextInput from '../components/TextInput'
import { Ionicons } from '@expo/vector-icons'
import PressableScale from '../components/PressableScale'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'
import { getServerUrl, updateServerUrl, pingServer } from '../api/client'
import { exportAllData } from '../db/database'
import FadeInView from '../components/FadeInView'
import { titleShadow } from '../cartoonStyles'

const STYLES = [
  { id: 'normal',  label: 'Normal',  bg: '#111111', surface: '#1e1e1e', accent: '#818cf8', text: '#f0f0f0' },
  { id: 'cuphead', label: 'Cuphead', bg: '#f0d9a0', surface: '#faecc8', accent: '#c01818', text: '#180800' },
]

export default function SettingsScreen() {
  const { theme: t, dark, toggleTheme, appStyle, setAppStyle } = useTheme()
  const { lang, setLang, t: tr } = useLang()
  const s = makeStyles(t)

  const [urlDisplay, setUrlDisplay] = useState(getServerUrl())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [exporting, setExporting] = useState(false)
  const [testState, setTestState] = useState('idle')   // idle | testing | ok | fail

  useEffect(() => {
    setUrlDisplay(getServerUrl())
  }, [])

  function openEdit() {
    setDraft(urlDisplay)
    setTestState('idle')
    setEditing(true)
  }

  async function handleTest() {
    setTestState('testing')
    const ok = await pingServer(editing ? draft : urlDisplay)
    setTestState(ok ? 'ok' : 'fail')
  }

  async function saveUrl() {
    await updateServerUrl(draft)
    setUrlDisplay(getServerUrl())
    setEditing(false)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const data = await exportAllData()
      const json = JSON.stringify(data, null, 2)
      await Share.share({ message: json, title: 'logpose-export.json' })
    } finally {
      setExporting(false)
    }
  }

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

        <View style={s.divider} />

        <View style={[s.row, s.rowColumn]}>
          <View>
            <Text style={s.rowLabel}>{tr('settings.serverUrl')}</Text>
            <Text style={s.rowSub}>{tr('settings.serverUrlDesc')}</Text>
          </View>
          {editing ? (
            <View style={s.urlEditRow}>
              <TextInput
                style={s.urlInput}
                value={draft}
                onChangeText={setDraft}
                placeholder={tr('settings.serverUrlPlaceholder')}
                placeholderTextColor={t.text4}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View style={s.urlBtns}>
                <TouchableOpacity style={s.urlBtnSave} onPress={saveUrl}>
                  <Text style={s.urlBtnSaveText}>{tr('common.save')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.urlBtnCancel} onPress={cancelEdit}>
                  <Text style={s.urlBtnCancelText}>{tr('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <PressableScale style={s.urlDisplayRow} onPress={openEdit}>
              <Text style={s.urlText} numberOfLines={1}>{urlDisplay}</Text>
              <Ionicons name="pencil" size={15} color={t.text3} />
            </PressableScale>
          )}
          <View style={s.testRow}>
            <PressableScale style={s.testBtn} onPress={handleTest} disabled={testState === 'testing'}>
              <Text style={s.testBtnText}>
                {testState === 'testing' ? tr('settings.testing') : tr('settings.testConnection')}
              </Text>
            </PressableScale>
            {testState === 'ok'   && <Text style={[s.testResult, { color: t.success }]}>✓ {tr('settings.testOk')}</Text>}
            {testState === 'fail' && <Text style={[s.testResult, { color: t.danger }]}>✕ {tr('settings.testFail')}</Text>}
          </View>
        </View>

        <View style={s.divider} />

        <View style={[s.row, s.rowColumn]}>
          <View>
            <Text style={s.rowLabel}>{tr('settings.export')}</Text>
            <Text style={s.rowSub}>{tr('settings.exportDesc')}</Text>
          </View>
          <TouchableOpacity
            style={[s.urlBtnSave, { width: '100%' }]}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.8}
          >
            <Text style={s.urlBtnSaveText}>
              {exporting ? tr('settings.exportSharing') : tr('settings.export')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </FadeInView>
  )
}

const makeStyles = (t) => StyleSheet.create({
  screen:          { flex: 1, backgroundColor: t.bg, padding: 16, paddingTop: 16 },
  title:           { color: t.cartoon ? t.accent : t.text, fontSize: 22, fontWeight: '700', marginBottom: 28, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', letterSpacing: t.cartoon ? 1 : 0, ...titleShadow(t) },
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
  urlDisplayRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.surface2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, width: '100%', borderWidth: t.cartoon ? 2 : 1, borderColor: t.border2 },
  testRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  testBtn:         { backgroundColor: t.surface2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: t.cartoon ? 2 : 1, borderColor: t.accent },
  testBtnText:     { color: t.accent, fontWeight: '700', fontSize: 13 },
  testResult:      { fontSize: 13, fontWeight: '700' },
  urlText:         { flex: 1, color: t.text2, fontSize: 13, fontFamily: 'DMSans_400Regular' },
  urlEditHint:     { color: t.text3, fontSize: 16 },
  urlEditRow:      { width: '100%', gap: 8 },
  urlInput:        { backgroundColor: t.surface2, color: t.text, borderRadius: 8, padding: 12, fontSize: 14, borderWidth: t.cartoon ? 2 : 1, borderColor: t.accent, fontFamily: 'DMSans_400Regular' },
  urlBtns:         { flexDirection: 'row', gap: 8 },
  urlBtnSave:      { flex: 1, backgroundColor: t.accent, borderRadius: 8, padding: 11, alignItems: 'center', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  urlBtnSaveText:  { color: t.cartoon ? t.bg : t.text, fontWeight: '700', fontSize: 14, fontFamily: t.fontTitle },
  urlBtnCancel:    { flex: 1, backgroundColor: t.border2, borderRadius: 8, padding: 11, alignItems: 'center' },
  urlBtnCancelText: { color: t.text2, fontWeight: '600', fontSize: 14 },
})
