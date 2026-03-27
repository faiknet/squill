import { useOthers, useRoom as useLiveblocksRoom } from '@liveblocks/react'

/**
 * Thin wrapper around Liveblocks room access.
 * Room provisioning/auth is configured by the provider setup.
 */
export function useRoom() {
  return useLiveblocksRoom()
}

export function useRoomMetadata() {
  const room = useLiveblocksRoom()
  const others = useOthers()

  return {
    roomId: room.id,
    othersCount: others.length,
  }
}
