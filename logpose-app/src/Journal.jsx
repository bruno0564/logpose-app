import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
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
import { IconClose, IconChevronLeft, IconChevronRight } from './Icons.jsx'
import ConfirmModal from './ConfirmModal.jsx'

// Fecha local de hoy (no UTC) — coherente con la capa de DB; se recalcula en
// cada llamada para no quedar desfasada si la app sigue abierta tras medianoche.
const today = () => new Date().toLocaleDateString('sv')

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
  const [lightboxIndex, setLightboxIndex] = useState(null)  // índice de la foto ampliada, o null
  const [confirmDeleteImg, setConfirmDeleteImg] = useState(null)  // foto pendiente de confirmar borrado
  const [zoom, setZoom] = useState(1)               // escala del lightbox
  const [pan, setPan] = useState({ x: 0, y: 0 })    // desplazamiento al arrastrar ampliado
  const fileInputRef = useRef(null)
  const urlsRef = useRef([])                         // object URLs vivos, para revocarlos

  function trackUrl(url) { urlsRef.current.push(url); return url }
  function revokeAllUrls() {
    for (const u of urlsRef.current) URL.revokeObjectURL(u)
    urlsRef.current = []
  }

  const loadImages = useCallback(async () => {
    revokeAllUrls()
    const rows = await getJournalImagesForDate(today())
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

  // Navegación del lightbox por teclado: Escape cierra, ←/→ cambian de foto
  useEffect(() => {
    if (lightboxIndex == null) return
    const onKey = e => {
      if (e.key === 'Escape') setLightboxIndex(null)
      else if (e.key === 'ArrowLeft') setLightboxIndex(i => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setLightboxIndex(i => Math.min(images.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, images.length])

  // Al abrir/cambiar de foto, reseteamos el zoom y el desplazamiento.
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [lightboxIndex])

  function onWheelZoom(e) {
    e.preventDefault()
    const next = Math.max(1, Math.min(5, zoom - e.deltaY * 0.0015))
    setZoom(next)
    if (next === 1) setPan({ x: 0, y: 0 })
  }

  function startDrag(e) {
    if (zoom <= 1) return
    e.preventDefault(); e.stopPropagation()
    const start = { x: e.clientX, y: e.clientY, baseX: pan.x, baseY: pan.y }
    const move = ev => setPan({ x: start.baseX + (ev.clientX - start.x), y: start.baseY + (ev.clientY - start.y) })
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

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
      await insertLocalJournalImage(today(), localPath, file.type, pos++)
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
    setHistory(all.filter(e => e.date !== today()))
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
          {formatDate(today())}
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
              {images.map((img, i) => (
                <div key={img.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-2)' }}>
                  <img
                    src={img.url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                    onClick={() => setLightboxIndex(i)}
                  />
                  <button
                    onClick={() => setConfirmDeleteImg(img)}
                    title={tr('common.delete')}
                    style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <IconClose size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Portal a document.body: el lightbox usa position:fixed y .page lleva un
          transform persistente (animación fadeUp con fill-mode both) que rompería
          el fixed confinándolo a .page. El portal lo saca a la raíz del body. */}
      {lightboxIndex != null && images[lightboxIndex] && createPortal(
        <div
          onClick={() => setLightboxIndex(null)}
          style={{ position: 'fixed', inset: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'zoom-out', padding: '2rem' }}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            title={tr('common.close')}
            aria-label={tr('common.close')}
            style={{ position: 'fixed', top: 16, right: 20, width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
          >
            <IconClose size={20} />
          </button>
          {lightboxIndex > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => Math.max(0, i - 1)) }}
              aria-label="prev"
              style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
            >
              <IconChevronLeft size={24} />
            </button>
          )}
          {lightboxIndex < images.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => Math.min(images.length - 1, i + 1)) }}
              aria-label="next"
              style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
            >
              <IconChevronRight size={24} />
            </button>
          )}
          <img
            src={images[lightboxIndex].url}
            alt=""
            onClick={e => e.stopPropagation()}
            onWheel={onWheelZoom}
            onMouseDown={startDrag}
            onDoubleClick={e => { e.stopPropagation(); setZoom(z => (z > 1 ? 1 : 2)); setPan({ x: 0, y: 0 }) }}
            draggable={false}
            style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)',
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              cursor: zoom > 1 ? 'grab' : 'zoom-in',
            }}
          />
        </div>,
        document.body
      )}

      {confirmDeleteImg && (
        <ConfirmModal
          message={tr('journal.deletePhotoMsg')}
          onConfirm={async () => { const img = confirmDeleteImg; setConfirmDeleteImg(null); await handleDeleteImage(img) }}
          onCancel={() => setConfirmDeleteImg(null)}
        />
      )}
    </div>
  )
}
