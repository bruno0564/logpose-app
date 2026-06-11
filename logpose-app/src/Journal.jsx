import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getTodayJournalEntry, getAllJournalEntries, saveJournalEntry, getJournalStreak,
  getUnsyncedJournalEntries, getPendingDeleteJournalEntries,
  markJournalEntrySynced, purgeLocalJournalEntry, upsertJournalEntryFromServer, pruneStaleJournalEntries,
  getJournalImagesForDate, insertLocalJournalImage, deleteLocalJournalImage,
  getUnsyncedJournalImages, getPendingDeleteJournalImages, markJournalImageSynced,
  purgeLocalJournalImage, localJournalImageByServerId, insertSyncedJournalImage, pruneStaleJournalImages,
} from './db/database'
import {
  isServerReachable,
  fetchAllJournalEntriesFromServer, postJournalEntryToServer, putJournalEntryToServer, deleteJournalEntryFromServer,
  fetchAllJournalImagesFromServer, uploadJournalImageToServer, downloadJournalImageBytes, deleteJournalImageFromServer,
} from './api/client'
import { saveImageBytes, readImageBytes, deleteImageFile, imageObjectURL } from './imageStore'
import { useLang } from './LangContext.jsx'

const TODAY = new Date().toISOString().slice(0, 10)

let syncingJournal = false

function wordCount(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

export default function Journal() {
  const { t: tr, tp, locale } = useLang()
  const [view, setView] = useState('today')
  const [entry, setEntry] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [streak, setStreak] = useState(0)
  const [history, setHistory] = useState([])
  const [images, setImages] = useState([])          // imágenes de HOY (con object URL)
  const [lightbox, setLightbox] = useState(null)    // url ampliada o null
  const fileInputRef = useRef(null)
  const urlsRef = useRef([])                         // object URLs vivos, para revocarlos

  function trackUrl(url) { urlsRef.current.push(url); return url }
  function revokeAllUrls() {
    for (const u of urlsRef.current) URL.revokeObjectURL(u)
    urlsRef.current = []
  }

  const loadImages = useCallback(async () => {
    revokeAllUrls()
    const rows = await getJournalImagesForDate(TODAY)
    const withUrls = []
    for (const r of rows) {
      try { withUrls.push({ ...r, url: trackUrl(await imageObjectURL(r.local_path, r.content_type)) }) }
      catch (e) { console.warn('no se pudo cargar la imagen', r.local_path, e) }
    }
    setImages(withUrls)
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

  // Sync binario de las imágenes: sube las nuevas, propaga borrados y descarga
  // del servidor las que falten en este dispositivo (local-first entre equipos).
  async function syncJournalImages() {
    for (const img of await getPendingDeleteJournalImages()) {
      try { await deleteJournalImageFromServer(img.server_id) } catch {}
      await deleteImageFile(img.local_path)
      await purgeLocalJournalImage(img.id)
    }
    for (const img of await getUnsyncedJournalImages()) {
      try {
        const bytes = await readImageBytes(img.local_path)
        const created = await uploadJournalImageToServer({
          date: img.date, position: img.position, caption: img.caption,
          bytes, contentType: img.content_type, filename: img.local_path.split('/').pop(),
        })
        await markJournalImageSynced(img.id, created.id)
      } catch (e) { console.warn('image upload failed:', e) }
    }
    const serverImgs = await fetchAllJournalImagesFromServer()
    for (const sImg of serverImgs) {
      if (await localJournalImageByServerId(sImg.id)) continue
      try {
        const bytes = await downloadJournalImageBytes(sImg.id)
        const localPath = await saveImageBytes(bytes, sImg.content_type)
        await insertSyncedJournalImage(sImg, localPath)
      } catch (e) { console.warn('image download failed:', e) }
    }
    const removed = await pruneStaleJournalImages(new Set(serverImgs.map(i => i.id)))
    for (const p of removed) await deleteImageFile(p)
  }

  useEffect(() => {
    loadToday().then(() => { loadStreak(); loadImages(); syncJournal() })
    return () => revokeAllUrls()
  }, [])

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

  async function onPickFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''   // permite volver a elegir el mismo archivo
    let pos = images.length
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const bytes = new Uint8Array(await file.arrayBuffer())
      const localPath = await saveImageBytes(bytes, file.type)
      await insertLocalJournalImage(TODAY, localPath, file.type, pos++)
    }
    await loadImages()
    syncJournal()
  }

  async function handleDeleteImage(img) {
    const pathToRemove = await deleteLocalJournalImage(img.id)
    if (pathToRemove) await deleteImageFile(pathToRemove)
    await loadImages()
    syncJournal()
  }

  async function openHistory() {
    const all = await getAllJournalEntries()
    setHistory(all.filter(e => e.date !== TODAY))
    setView('history')
  }

  if (view === 'history') {
    return (
      <div className="page">
        <div className="page-header">
          <button
            onClick={() => setView('today')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: '0.75rem' }}
          >
            {tr('journal.back')}
          </button>
          <h1 className="page-title">{tr('journal.historyTitle')}</h1>
        </div>

        {history.length === 0 ? (
          <p className="hint">{tr('journal.noHistory')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 640 }}>
            {history.map(e => (
              <div key={e.id} className="card" style={{ padding: '1.25rem' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', textTransform: 'capitalize', marginBottom: '0.6rem' }}>
                  {formatDate(e.date)}
                </p>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {e.content || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>{tr('journal.noContent')}</span>}
                </p>
                <p style={{ color: 'var(--text-3)', fontSize: '0.72rem', marginTop: '0.75rem' }}>
                  {tp('journal.wordCount', wordCount(e.content))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const words = wordCount(draft)

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="page-title">{tr('journal.title')}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {streak > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', background: 'var(--surface-2)', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-2)' }}>
                {tp('journal.streak', streak)}
              </span>
            )}
            <button
              className="btn-cancel"
              style={{ fontSize: '0.8rem' }}
              onClick={openHistory}
            >
              {tr('journal.historyBtn')}
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: '0.4rem', textTransform: 'capitalize' }}>
          {formatDate(TODAY)}
        </p>
      </div>

      <div style={{ maxWidth: 640 }}>
        <textarea
          className="journal-textarea"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={tr('journal.placeholder')}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.6rem' }}>
          <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>
            {tp('journal.wordCount', words)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {saved && <span style={{ color: '#22c55e', fontSize: '0.78rem' }}>{tr('journal.saved')}</span>}
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !draft.trim()}
            >
              {saving ? tr('journal.saving') : tr('journal.save')}
            </button>
          </div>
        </div>

        {/* Galería de imágenes del día */}
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ color: 'var(--text-2)', fontSize: '0.82rem', fontWeight: 600 }}>{tr('journal.photos')}</span>
            <button className="btn-cancel" style={{ fontSize: '0.8rem' }} onClick={() => fileInputRef.current?.click()}>
              + {tr('journal.addPhoto')}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={onPickFiles}
          />
          {images.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{tr('journal.noPhotos')}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.5rem' }}>
              {images.map(img => (
                <div key={img.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-2)' }}>
                  <img
                    src={img.url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                    onClick={() => setLightbox(img.url)}
                  />
                  <button
                    onClick={() => handleDeleteImage(img)}
                    title={tr('common.delete')}
                    style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.8rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, cursor: 'zoom-out', padding: '2rem' }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} />
        </div>
      )}
    </div>
  )
}
