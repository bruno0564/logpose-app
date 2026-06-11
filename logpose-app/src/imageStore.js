// Almacenamiento en disco de las imágenes del journal (desktop / Tauri).
// Los bytes viven como ficheros dentro de appLocalData/journal_images/.
// La BD solo guarda la ruta local relativa (ver db/database.js).
import { BaseDirectory, mkdir, writeFile, readFile, remove } from '@tauri-apps/plugin-fs'

const DIR = 'journal_images'
const baseDir = BaseDirectory.AppLocalData

function extFromType(contentType) {
  switch (contentType) {
    case 'image/png':  return '.png'
    case 'image/webp': return '.webp'
    case 'image/gif':  return '.gif'
    case 'image/heic': return '.heic'
    default:           return '.jpg'   // image/jpeg y desconocidos
  }
}

async function ensureDir() {
  try { await mkdir(DIR, { baseDir, recursive: true }) } catch {}
}

// Guarda los bytes en un fichero nuevo y devuelve la ruta local relativa.
export async function saveImageBytes(bytes, contentType) {
  await ensureDir()
  const name = `${crypto.randomUUID()}${extFromType(contentType)}`
  const path = `${DIR}/${name}`
  await writeFile(path, bytes, { baseDir })
  return path
}

export async function readImageBytes(localPath) {
  return readFile(localPath, { baseDir })   // Uint8Array
}

export async function deleteImageFile(localPath) {
  if (!localPath) return
  try { await remove(localPath, { baseDir }) } catch {}
}

// Crea un object URL para pintar la imagen en un <img>. El llamador debe
// revocarlo (URL.revokeObjectURL) cuando ya no lo use.
export async function imageObjectURL(localPath, contentType) {
  const bytes = await readImageBytes(localPath)
  return URL.createObjectURL(new Blob([bytes], { type: contentType }))
}
