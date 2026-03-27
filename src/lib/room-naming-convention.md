# Room Naming Convention

## Session Notes

For session notes (real-time collaborative editing):

```
session-note:{campaignId}:{sessionId}
```

**Examples:**
- `session-note:abc123:session-2026-03-16`
- `session-note:def456:notes-on-the-forest`

## Campaign Documents

For campaign-wide documents:

```
campaign-doc:{campaignId}
```

**Examples:**
- `campaign-doc:abc123`
- `campaign-doc:def456`

## User Rooms

For user-specific data:

```
{campaignId}:{userId}
```

**Examples:**
- `abc123:user-123`
- `def456:user-456`

## Integration with Supabase

When a room disconnects, the Liveblocks webhook will fire:
- Webhook converts Yjs doc to Markdown
- Upsert into `session_notes.content_md` in Supabase

## Setup Instructions

### 1. Get Liveblocks Public Key
1. Visit https://dashboard.liveblocks.io
2. Create an account or sign in
3. Navigate to your project settings
4. Copy the **Public Key** (starts with `lb_test_` or `lb_prod_`)

### 2. Configure Environment Variables
Add to your `.env` file:

```env
VITE_LIVEBLOCKS_PUBLIC_KEY=lb_test_xxxxxx
```

**Important:** Only the public key should be in your frontend environment. Keep your secret key server-side.

### 3. Verify Room Names

Ensure your room names:
- Start with a valid prefix (`session-note:`, `campaign-doc:`, etc.)
- Use only alphanumeric characters, hyphens, and underscores
- Don't exceed 255 characters
- Follow a consistent pattern for your app

### 4. Usage in Components

```jsx
import { useRoom } from '@liveblocks/react'

function SessionEditor({ roomName, userId }) {
  const { room, doc } = useRoom(roomName, userId)

  // Room is automatically created if it doesn't exist
  // Doc is a Yjs Document backed by the room

  return (
    <div>
      <h1>Session: {roomName}</h1>
      {/* Your editor components here */}
    </div>
  )
}
```

## Room Structure

```
src/
  lib/
    liveblocks.js       # Liveblocks configuration
    supabase.ts         # Supabase client
  hooks/
    useRoom.ts          # Custom room hooks
  components/
    editor/
      SessionEditor.jsx # Uses useRoom for editor
```
