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
    let errorMessage = ''
    if (err instanceof Error) {
      errorMessage = err.message
    } else if (err && typeof err === 'object' && err.message) {
      errorMessage = err.message
    } else {
      errorMessage = String(err)
    }
    setError(errorMessage || 'An error occurred')
  }, [])

  const clear = useCallback(() => {
    setError('')
    setMessage('')
  }, [])

  return { error, message, setSuccess, setFail, clear }
}
