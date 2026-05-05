/**
 * useFileUpload
 * -------------
 * Convenience hook that combines validation + upload for any component
 * that needs to trigger a file upload (MessageInput, NewChatPage, etc.)
 *
 * Usage:
 *   const { handleFile, validationError, clearError } = useFileUpload(onUpload)
 *
 * This is the single place where validateDocumentFile is called before
 * handing off to the onUpload callback. Keeps validation logic DRY.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { validateDocumentFile, extractFirstAllowedFile } from '../utils/fileValidation.js'

/**
 * @param {function} onUpload - (file: File) => void | Promise<void>
 * @param {object}   [opts]
 * @param {number}   [opts.errorAutoDismissMs=6000]
 */
export function useFileUpload(onUpload, { errorAutoDismissMs = 6000 } = {}) {
  const [validationError, setValidationError] = useState(null)
  const [isWarn,          setIsWarn]          = useState(false)
  const timerRef = useRef(null)

  // Auto-dismiss error/warning
  useEffect(() => {
    if (!validationError) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setValidationError(null)
      setIsWarn(false)
    }, errorAutoDismissMs)
    return () => clearTimeout(timerRef.current)
  }, [validationError, errorAutoDismissMs])

  /**
   * Validate a File and, if valid, call onUpload.
   * @param {File} file
   */
  const handleFile = useCallback(async (file) => {
    if (!file) return
    const result = await validateDocumentFile(file)

    if (!result.valid) {
      setValidationError(result.error)
      setIsWarn(false)
      return false
    }

    if (result.warn) {
      setValidationError(result.warn)
      setIsWarn(true)
      // Still proceed — warning is advisory only
    } else {
      setValidationError(null)
      setIsWarn(false)
    }

    await onUpload?.(file)
    return true
  }, [onUpload])

  /**
   * Handle a drag-drop DataTransfer or file input event.
   * Picks the first allowed file from the FileList.
   * @param {FileList | DataTransfer} files
   */
  const handleFiles = useCallback(async (files) => {
    const file = extractFirstAllowedFile(files)
    if (!file) {
      setValidationError('No supported file found. Please use PDF, DOCX, or TXT.')
      setIsWarn(false)
      return false
    }
    return handleFile(file)
  }, [handleFile])

  const clearError = useCallback(() => {
    setValidationError(null)
    setIsWarn(false)
  }, [])

  return { handleFile, handleFiles, validationError, isWarn, clearError }
}
