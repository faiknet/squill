import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useSupabaseAuth'
import { requireSupabase } from '../lib/supabase'
import {
  ACHIEVEMENT_DEFINITIONS,
  getStoredAchievements,
  setStoredAchievement,
} from '../lib/achievements'

export function useAchievements() {
  const { authState } = useAuth()
  const { isGuest, user } = authState
  const [achievements, setAchievements] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const loadAchievements = useCallback(async () => {
    setIsLoading(true)
    try {
      if (isGuest || !user) {
        const stored = getStoredAchievements(true)
        setAchievements(
          ACHIEVEMENT_DEFINITIONS.map((def) => {
            const earned = stored.find((s) => s.slug === def.slug)
            return { ...def, earned_at: earned?.earned_at || null, progress: earned?.progress || 0 }
          })
        )
        return
      }

      const client = requireSupabase()
      const { data, error } = await client.rpc('get_user_achievements')
      if (error) throw error

      if (data) {
        setAchievements(data)
        const synced = data.filter((a) => a.earned_at).map((a) => ({ slug: a.slug, earned_at: a.earned_at, progress: a.progress }))
        window.localStorage.setItem('squill:achievements', JSON.stringify(synced))
      }
    } catch (err) {
      console.warn('Failed to load achievements:', err)
      const stored = getStoredAchievements(false)
      setAchievements(
        ACHIEVEMENT_DEFINITIONS.map((def) => {
          const earned = stored.find((s) => s.slug === def.slug)
          return { ...def, earned_at: earned?.earned_at || null, progress: earned?.progress || 0 }
        })
      )
    } finally {
      setIsLoading(false)
    }
  }, [isGuest, user])

  useEffect(() => {
    loadAchievements()
  }, [loadAchievements])

  const checkAndAward = useCallback(async (slug) => {
    if (isGuest || !user) {
      const now = new Date().toISOString()
      setStoredAchievement(slug, { earned_at: now, progress: 0 }, true)
      setAchievements((prev) =>
        prev.map((a) => (a.slug === slug ? { ...a, earned_at: now } : a))
      )
      return true
    }

    try {
      const client = requireSupabase()
      const { data, error } = await client.rpc('award_achievement', { p_achievement_slug: slug })
      if (error) throw error
      if (data && data[0]) {
        setAchievements((prev) =>
          prev.map((a) => (a.slug === slug ? { ...a, earned_at: data[0].earned_at } : a))
        )
        const stored = getStoredAchievements(false)
        stored.push({ slug, earned_at: data[0].earned_at, progress: 0 })
        window.localStorage.setItem('squill:achievements', JSON.stringify(stored))
      }
      return true
    } catch (err) {
      console.warn('Failed to award achievement:', err)
      return false
    }
  }, [isGuest, user])

  const updateProgress = useCallback(async (slug, progress) => {
    if (isGuest || !user) {
      setStoredAchievement(slug, { progress }, true)
      setAchievements((prev) =>
        prev.map((a) => (a.slug === slug ? { ...a, progress } : a))
      )
      return
    }

    try {
      const client = requireSupabase()
      const { data, error } = await client.rpc('update_achievement_progress', {
        p_achievement_slug: slug,
        p_progress: progress,
      })
      if (error) throw error
      if (data && data[0]) {
        setAchievements((prev) =>
          prev.map((a) => (a.slug === slug ? { ...a, earned_at: data[0].earned_at, progress: data[0].progress } : a))
        )
      }
    } catch (err) {
      console.warn('Failed to update achievement progress:', err)
    }
  }, [isGuest, user])

  const earnedAchievements = achievements.filter((a) => a.earned_at)

  return { achievements, earnedAchievements, checkAndAward, updateProgress, isLoading }
}
