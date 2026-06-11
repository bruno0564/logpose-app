// Almacenamiento en disco de las imágenes del journal (móvil / Expo).
// Los bytes son ficheros dentro de documentDirectory/journal_images/.
// La BD solo guarda la URI local (ver db/database.js).
import * as FileSystem from 'expo-file-system/legacy'

const DIR = FileSystem.documentDirectory + 'journal_images/'

function extFromType(contentType) {
  switch (contentType) {
    case 'image/png':  return '.png'
    case 'image/webp': return '.webp'
    case 'image/gif':  return '.gif'
    case 'image/heic': return '.heic'
    default:           return '.jpg'
  }
}

function uniqueName(contentType) {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}${extFromType(contentType)}`
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR)
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true })
}

// Copia la imagen elegida (uri del image picker) a la carpeta de la app.
export async function saveImageFromUri(srcUri, contentType) {
  await ensureDir()
  const dest = DIR + uniqueName(contentType)
  await FileSystem.copyAsync({ from: srcUri, to: dest })
  return dest
}

// Descarga una imagen del servidor a un fichero local nuevo.
export async function downloadImageToFile(url, contentType) {
  await ensureDir()
  const dest = DIR + uniqueName(contentType)
  await FileSystem.downloadAsync(url, dest)
  return dest
}

export async function deleteImageFile(uri) {
  if (!uri) return
  try { await FileSystem.deleteAsync(uri, { idempotent: true }) } catch {}
}
