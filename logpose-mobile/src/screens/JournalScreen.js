import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, TouchableOpacity, ScrollView, Image, Modal,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import Text from '../components/Text'
import TextInput from '../components/TextInput'
import GradientButton from '../components/GradientButton'
import FadeInView from '../components/FadeInView'
import ImageGallery from '../components/ImageGallery'
import { titleShadow } from '../cartoonStyles'
import {
  getTodayJournalEntry, getAllJournalEntries, saveJournalEntry, getJournalStreak,
  getUnsyncedJournalEntries, getPendingDeleteJournalEntries,
  markJournalEntrySynced, purgeLocalJournalEntry, upsertJournalEntryFromServer, pruneStaleJournalEntries,
  getJournalImagesForDate, insertLocalJournalImage, deleteLocalJournalImage,
  getUnsyncedJournalImages, getPendingDeleteJournalImages, markJournalImageSynced,
  purgeLocalJournalImage, localJournalImageByServerId, insertSyncedJournalImage, pruneStaleJournalImages,
} from '../db/database'
import {
  isServerReachable,
  fetchAllJournalEntriesFromServer, postJournalEntryToServer, putJournalEntryToServer, deleteJournalEntryFromServer,
  fetchAllJournalImagesFromServer, uploadJournalImageToServer, deleteJournalImageFromServer, journalImageFileUrl,
} from '../api/client'
import { saveImageFromUri, downloadImageToFile, deleteImageFile } from '../imageStore'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

// Fecha local de hoy (no UTC) — coherente con la capa de DB; se recalcula en
// cada llamada para no quedar desfasada si la app sigue abierta tras medianoche.
const today = () => new Date().toLocaleDateString('sv')

let syncingJournal = false

function wordCount(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

export default function JournalScreen() {
  const { theme: t } = useTheme()
  const { t: tr, tp, locale } = useLang()
  const s = makeStyles(t)
  const [view, setView] = useState('today')
  const [entry, setEntry] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [streak, setStreak] = useState(0)
  const [history, setHistory] = useState([])
  const [images, setImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [confirmDeleteImg, setConfirmDeleteImg] = useState(null)

  const loadImages = useCallback(async () => {
    setImages(await getJournalImagesForDate(today()))
  }, [])

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-')
    const str = new Date(+y, +m - 1, +d).toLocaleDateString(locale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  const loadToday = useCallback(async () => {
    const e = await getTodayJournalEntry()
    setEntry(e)
    setDraft(e?.content ?? '')
  }, [])

  const loadStreak = useCallback(async () => {
    setStreak(await getJournalStreak())
  }, [])

  const syncJournal = useCallback(async () => {
    if (syncingJournal) return
    syncingJournal = true
    try {
      if (!await isServerReachable()) return
      for (const e of await getPendingDeleteJournalEntries()) {
        try { await deleteJournalEntryFromServer(e.server_id) } catch {}
        await purgeLocalJournalEntry(e.id)
      }
      for (const e of await getUnsyncedJournalEntries()) {
        try {
          if (e.server_id) {
            await putJournalEntryToServer(e.server_id, e)
            await markJournalEntrySynced(e.id, e.server_id)
          } else {
            const created = await postJournalEntryToServer(e)
            await markJournalEntrySynced(e.id, created.id)
          }
        } catch {}
      }
      const serverEntries = await fetchAllJournalEntriesFromServer()
      for (const e of serverEntries) await upsertJournalEntryFromServer(e)
      await pruneStaleJournalEntries(new Set(serverEntries.map(e => e.id)))
      await syncJournalImages()
    } catch (e) { console.warn('journal sync failed:', e) } finally {
      syncingJournal = false
      await loadToday()
      await loadStreak()
      await loadImages()
    }
  }, [loadToday, loadStreak, loadImages])

  // Sync binario de imágenes: sube nuevas, propaga borrados y descarga las que
  // falten en este dispositivo.
  async function syncJournalImages() {
    for (const img of await getPendingDeleteJournalImages()) {
      try { await deleteJournalImageFromServer(img.server_id) } catch {}
      await deleteImageFile(img.local_uri)
      await purgeLocalJournalImage(img.id)
    }
    for (const img of await getUnsyncedJournalImages()) {
      try {
        const created = await uploadJournalImageToServer({
          date: img.date, position: img.position, caption: img.caption,
          uri: img.local_uri, contentType: img.content_type, filename: img.local_uri.split('/').pop(),
        })
        await markJournalImageSynced(img.id, created.id)
      } catch (e) { console.warn('image upload failed:', e) }
    }
    const serverImgs = await fetchAllJournalImagesFromServer()
    for (const sImg of serverImgs) {
      if (await localJournalImageByServerId(sImg.id)) continue
      try {
        const localUri = await downloadImageToFile(journalImageFileUrl(sImg.id), sImg.content_type)
        await insertSyncedJournalImage(sImg, localUri)
      } catch (e) { console.warn('image download failed:', e) }
    }
    const removed = await pruneStaleJournalImages(new Set(serverImgs.map(i => i.id)))
    for (const u of removed) await deleteImageFile(u)
  }

  useFocusEffect(
    useCallback(() => {
      loadToday().then(() => { loadStreak(); loadImages(); syncJournal() })
    }, [loadToday, loadStreak, loadImages, syncJournal])
  )

  async function handleSave() {
    if (!draft.trim()) return
    setSaving(true)
    await saveJournalEntry(draft)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await loadToday()
    await loadStreak()
    syncJournal()
  }

  async function handlePickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (result.canceled) return
    let pos = images.length
    for (const asset of result.assets) {
      const contentType = asset.mimeType || 'image/jpeg'
      const localUri = await saveImageFromUri(asset.uri, contentType)
      await insertLocalJournalImage(today(), localUri, contentType, pos++)
    }
    await loadImages()
    syncJournal()
  }

  async function handleDeleteImage(img) {
    const uriToRemove = await deleteLocalJournalImage(img.id)
    if (uriToRemove) await deleteImageFile(uriToRemove)
    await loadImages()
    syncJournal()
  }

  async function openHistory() {
    const all = await getAllJournalEntries()
    setHistory(all.filter(e => e.date !== today()))
    setView('history')
  }

  if (view === 'history') {
    return (
      <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => setView('today')} style={{ marginBottom: 12 }}>
          <Text style={s.backBtn}>{tr('journal.back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{tr('journal.historyTitle')}</Text>
        <View style={{ height: 16 }} />

        {history.length === 0 ? (
          <Text style={s.hint}>{tr('journal.noHistory')}</Text>
        ) : (
          history.map(e => (
            <View key={e.id} style={[s.card, { marginBottom: 12 }]}>
              <Text style={s.dateLabel}>{formatDate(e.date)}</Text>
              <Text style={s.entryText}>
                {e.content || <Text style={s.emptyText}>{tr('journal.noContent')}</Text>}
              </Text>
              <Text style={s.wordCount}>{tp('journal.wordCount', wordCount(e.content))}</Text>
            </View>
          ))
        )}
      </ScrollView>
    )
  }

  const words = wordCount(draft)

  return (
    <FadeInView style={{ flex: 1 }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View>
            <Text style={s.title}>{tr('journal.title')}</Text>
            <Text style={s.dateLabel}>{formatDate(today())}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {streak > 0 && (
              <View style={s.streakBadge}>
                <Text style={s.streakText}>{tp('journal.streak', streak)}</Text>
              </View>
            )}
            <TouchableOpacity style={s.btnCancel} onPress={openHistory}>
              <Text style={s.btnCancelText}>{tr('journal.historyBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={s.textarea}
          value={draft}
          onChangeText={setDraft}
          placeholder={tr('journal.placeholder')}
          placeholderTextColor={t.text4}
          multiline
          textAlignVertical="top"
        />

        <View style={s.footer}>
          <Text style={s.wordCount}>{tp('journal.wordCount', words)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {saved && <Text style={{ color: t.success, fontSize: 12 }}>{tr('journal.saved')}</Text>}
            <GradientButton
              onPress={handleSave}
              label={saving ? tr('journal.saving') : tr('journal.save')}
              disabled={!draft.trim()}
              loading={saving}
            />
          </View>
        </View>

        {/* Galería de imágenes del día */}
        <View style={{ marginTop: 24 }}>
          <View style={s.photosHeader}>
            <Text style={s.photosTitle}>{tr('journal.photos')}</Text>
            <TouchableOpacity style={s.addPhotoBtn} onPress={handlePickImage}>
              <Ionicons name="image-outline" size={15} color={t.accent} />
              <Text style={s.addPhotoText}>{tr('journal.addPhoto')}</Text>
            </TouchableOpacity>
          </View>
          {images.length === 0 ? (
            <Text style={s.hint}>{tr('journal.noPhotos')}</Text>
          ) : (
            <View style={s.grid}>
              {images.map((img, i) => (
                <View key={img.id} style={s.thumbWrap}>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setLightboxIndex(i)}>
                    <Image source={{ uri: img.local_uri }} style={s.thumb} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.thumbDelete} onPress={() => setConfirmDeleteImg(img)} hitSlop={8}>
                    <Text style={s.thumbDeleteText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={lightboxIndex != null} transparent animationType="fade" onRequestClose={() => setLightboxIndex(null)}>
        {lightboxIndex != null && (
          <ImageGallery images={images} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
        )}
      </Modal>

      <Modal visible={!!confirmDeleteImg} transparent animationType="fade" onRequestClose={() => setConfirmDeleteImg(null)}>
        <TouchableOpacity style={s.confirmOverlay} activeOpacity={1} onPress={() => setConfirmDeleteImg(null)}>
          <TouchableOpacity activeOpacity={1} style={s.confirmCard}>
            <Text style={s.confirmMsg}>{tr('journal.deletePhotoMsg')}</Text>
            <View style={s.confirmRow}>
              <TouchableOpacity style={s.confirmCancel} onPress={() => setConfirmDeleteImg(null)}>
                <Text style={s.confirmCancelText}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmDelete}
                onPress={async () => { const img = confirmDeleteImg; setConfirmDeleteImg(null); await handleDeleteImage(img) }}
              >
                <Text style={s.confirmDeleteText}>{tr('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
    </FadeInView>
  )
}

const makeStyles = (t) => StyleSheet.create({
  screen:      { flex: 1, backgroundColor: t.bg, padding: 16, paddingTop: 16 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  title:       { color: t.cartoon ? t.accent : t.text, fontSize: 22, fontWeight: '700', letterSpacing: t.cartoon ? 0.5 : -0.5, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', ...titleShadow(t) },
  dateLabel:   { color: t.text3, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  backBtn:     { color: t.accent, fontSize: 14, marginBottom: 12 },
  hint:        { color: t.text3, fontSize: 13 },
  card:        { backgroundColor: t.surface, borderRadius: 12, padding: 14, borderWidth: t.cardBorderWidth, borderColor: t.cardBorderColor, ...t.shadow },
  entryText:   { color: t.text2, fontSize: 14, lineHeight: 22 },
  emptyText:   { color: t.text4, fontStyle: 'italic' },
  wordCount:   { color: t.text4, fontSize: 11, marginTop: 8 },
  streakBadge: { backgroundColor: t.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: t.border2 },
  streakText:  { color: t.text2, fontSize: 12 },
  textarea:    { backgroundColor: t.surface, borderWidth: t.cartoon ? 2 : 1, borderColor: t.cartoon ? t.text : t.border, borderRadius: 10, color: t.text, padding: 14, fontSize: 15, lineHeight: 24, minHeight: 300 },
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  photosHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  photosTitle: { color: t.text2, fontSize: 14, fontWeight: '600' },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: t.border2, backgroundColor: t.surface2 },
  addPhotoText:{ color: t.accent, fontSize: 13, fontWeight: '600' },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap:   { position: 'relative' },
  thumb:       { width: 96, height: 96, borderRadius: 8, borderWidth: 1, borderColor: t.border2, backgroundColor: t.surface2 },
  thumbDelete: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbDeleteText: { color: '#fff', fontSize: 15, lineHeight: 17, fontWeight: '700' },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  confirmCard: { backgroundColor: t.surface, borderRadius: 14, padding: 20, width: '100%', maxWidth: 340, borderWidth: t.cardBorderWidth, borderColor: t.cardBorderColor, ...t.shadow },
  confirmMsg:  { color: t.text, fontSize: 15, fontWeight: '600', marginBottom: 18 },
  confirmRow:  { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  confirmCancel: { backgroundColor: t.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  confirmCancelText: { color: t.text2, fontSize: 14, fontWeight: '600' },
  confirmDelete: { backgroundColor: t.dangerBg, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  confirmDeleteText: { color: t.dangerText, fontSize: 14, fontWeight: '600' },
  btnPrimary:  { backgroundColor: t.accent, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 9, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  btnPrimaryText: { color: t.cartoon ? t.bg : t.text, fontSize: 14, fontWeight: '600', fontFamily: t.fontTitle },
  btnCancel:   { backgroundColor: t.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  btnCancelText: { color: t.text2, fontSize: 13 },
})
