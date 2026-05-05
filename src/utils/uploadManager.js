/**
 * uploadManager.js — XHR upload with progress + retry
 * ──────────────────────────────────────────────────────
 * fetch() has no upload progress events.
 * XHR has xhr.upload.onprogress — fires per-chunk, gives e.loaded/e.total.
 * Exponential-backoff retry on 5xx / network errors.
 * Abort support via AbortSignal.
 *
 * extraFields: additional FormData string fields to include alongside file.
 * Used by apiUploadFirst to send anonymous_id as a form field.
 */
export function uploadWithProgress(url, file, { onProgress, signal, headers = {}, extraFields = {} } = {}) {
  let attempt = 0

  function tryOnce() {
    return new Promise((res, rej) => {
      const xhr = new XMLHttpRequest()
      xhr.timeout = 120_000

      if (signal) {
        if (signal.aborted) return rej(new DOMException('Aborted', 'AbortError'))
        signal.addEventListener(
          'abort',
          () => { xhr.abort(); rej(new DOMException('Aborted', 'AbortError')) },
          { once: true }
        )
      }

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100))
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { res(JSON.parse(xhr.responseText)) }
          catch { rej(new Error('Invalid JSON from server')) }
        } else {
          let msg = xhr.statusText
          try { msg = JSON.parse(xhr.responseText)?.detail ?? msg } catch {}
          const e = new Error(msg)
          e.status = xhr.status
          rej(e)
        }
      }
      xhr.onerror   = () => rej(new Error('Network error — check your connection.'))
      xhr.ontimeout = () => rej(new Error('Upload timed out.'))

      xhr.open('POST', url)
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))

      const fd = new FormData()
      fd.append('file', file)
      // Append any extra string fields (e.g. anonymous_id for first upload)
      Object.entries(extraFields).forEach(([k, v]) => fd.append(k, v ?? ''))
      xhr.send(fd)
    })
  }

  async function run() {
    while (true) {
      attempt++
      try {
        return await tryOnce()
      } catch (err) {
        if (err.name === 'AbortError') throw err
        if ((err.status >= 400 && err.status < 500) || attempt >= 3) throw err
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
      }
    }
  }

  return run()
}
