import { useState, useCallback } from 'react'

export function useFormState() {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const setSuccess = useCallback((msg) => {
    setError('')
    setMessage(msg)
  }, [])

  const setFail = useCallback((err) => {
    setMessage('')
    setError(err instanceof Error ? err.message : String(err))
  }, [])

  const clear = useCallback(() => {
    setError('')
    setMessage('')
  }, [])

  return { error, message, setSuccess, setFail, clear }
}
