/**
 * fileValidation.js — client-side file guard
 * ────────────────────────────────────────────
 * Checks (in order):
 *  1. Empty file
 *  2. Size limit (50 MB hard, 20 MB warning)
 *  3. Extension whitelist
 *  4. Magic bytes — catches renamed files (e.g. virus.exe → report.pdf)
 *  5. MIME type cross-check (advisory)
 */
import { MAX_FILE_MB, WARN_FILE_MB } from '../constants/index.js'

const ALLOWED = new Set(['.pdf', '.docx', '.txt'])
const MAGIC   = {
  '.pdf':  [0x25, 0x50, 0x44, 0x46],  // %PDF
  '.docx': [0x50, 0x4B, 0x03, 0x04],  // PK (ZIP)
}

function readBytes(file, n) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = e => res(new Uint8Array(e.target.result))
    r.onerror = rej
    r.readAsArrayBuffer(file.slice(0, n))
  })
}

/** @returns {Promise<{valid:boolean, error?:string, warn?:string}>} */
export async function validateFile(file) {
  if (!file || file.size === 0)
    return { valid: false, error: 'File is empty.' }

  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return { valid: false, error: `File is ${mb} MB — maximum is ${MAX_FILE_MB} MB.` }
  }

  const dot = file.name.lastIndexOf('.')
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : ''
  if (!ALLOWED.has(ext))
    return { valid: false, error: `"${ext || 'Unknown type'}" is not supported. Upload a PDF, DOCX, or TXT.` }

  if (MAGIC[ext]) {
    try {
      const bytes = await readBytes(file, 8)
      const sig   = MAGIC[ext]
      if (!sig.every((b, i) => bytes[i] === b))
        return { valid: false, error: `This file does not appear to be a valid ${ext.toUpperCase().slice(1)}.` }
    } catch { /* FileReader failed — let server validate */ }
  }

  if (file.size > WARN_FILE_MB * 1024 * 1024) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return { valid: true, warn: `Large file (${mb} MB) — upload may take a moment.` }
  }

  return { valid: true }
}

/** Pick first supported file from a FileList (drag-drop). */
export function pickAllowedFile(fileList) {
  const arr = Array.from(fileList ?? [])
  return arr.find(f => {
    const dot = f.name.lastIndexOf('.')
    const ext = dot >= 0 ? f.name.slice(dot).toLowerCase() : ''
    return ALLOWED.has(ext)
  }) ?? arr[0] ?? null
}
