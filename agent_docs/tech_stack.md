# Tech Stack & Tools — Scribe's Quill

**App:** Scribe's Quill — Collaborative TTRPG Campaign Notes
**Version:** MVP v1.0
**Budget:** $0/month — Free tiers only

---

## 📦 Frontend Stack

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.x | UI framework |
| @vitejs/plugin-react | 4.x | Vite React plugin |
| react-router-dom | 6.x | Client-side routing |

### Styling
| Package | Version | Purpose |
|---------|---------|---------|
| tailwindcss | 3.x | Utility-first CSS |
| autoprefixer | 10.x | PostCSS autoprefixing |

### Rich Text Editor
| Package | Version | Purpose |
|---------|---------|---------|
| @tiptap/react | 2.x | Headless editor UI |
| @tiptap/starter-kit | 2.x | Core editor extensions |
| @tiptap/extension-collaboration | 2.x | Yjs CRDT binding |
| @tiptap/extension-collaboration-cursor | 2.x | Collaboration cursors |

### Real-Time Collaboration
| Package | Version | Purpose |
|---------|---------|---------|
| @liveblocks/client | 2.x | Real-time presence, cursors |
| @liveblocks/react | 2.x | React hooks |
| @liveblocks/yjs | 2.x | Yjs document provider |

### Database & Auth
| Package | Version | Purpose |
|---------|---------|---------|
| @supabase/supabase-js | 2.x | Supabase client |

### Utilities
| Package | Version | Purpose |
|---------|---------|---------|
| date-fns | 3.x | Date formatting |
| clsx | 2.x | Class name utilities |
| react-hook-form | 7.x | Form handling |
| zod | 3.x | Runtime validation |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| typescript | 5.x | Type checking |
| @types/react | 18.x | React types |
| @types/react-dom | 18.x | React DOM types |
| vite | 5.x | Build tooling |
| eslint | 8.x | Code linting |
| prettier | 3.x | Code formatting |

---

## 🔧 Backend Stack (Serverless)

### Platform
| Service | Purpose | Free Tier |
|---------|---------|-----------|
| Supabase | Postgres DB + Auth + Storage | 500MB DB, 50K MAU |
| Liveblocks | Real-time collab infra | 50 monthly active users |
| Vercel | Frontend hosting | Free forever |
| GitHub | Source control | Free |

### Edge Functions (Supabase)
| Function | Purpose |
|----------|---------|
| `join-campaign` | Adds user to campaign via invite link |
| `snapshot-note` | Persists Yjs doc to Markdown on disconnect |

---

## 🎨 Design System

### Color Palette (Parchment-inspired)
```css
--bg-primary: #F5F0E1      /* Warm parchment */
--bg-secondary: #E8E0D1    /* Lighter parchment */
--text-primary: #2D241E    /* Dark brown text */
--text-secondary: #5C4E45  /* Medium brown */
--accent: #8B4513          /* SaddleBrown */
--npc-color: #8B4513       /* NPC tag */
--location-color: #4682B4  /* Location tag */
--item-color: #556B2F      /* Item tag */
```

### Typography
- **Headings:** Monospace font (evoking "quill" feel)
- **Body:** Sans-serif for readability
- **Code:** Monospace inline for tags/commands

---

## 📱 Responsive Breakpoints

| Name | Width | Use Case |
|------|-------|----------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Large desktop |

---

## 🚀 Setup Commands

### Initial Setup
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Check code style
npm run lint
```

### Supabase Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Deploy Edge Functions
supabase functions deploy join-campaign
supabase functions deploy snapshot-note
```

### Liveblocks Setup
```bash
# Copy public key to .env
VITE_LIVEBLOCKS_PUBLIC_KEY=your-public-key-from-liveblocks-dashboard
```

### Vercel Deploy
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

---

## 🔑 Environment Variables

Create a `.env` file (never commit it!):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_LIVEBLOCKS_PUBLIC_KEY=your-liveblocks-public-key
VITE_APP_NAME=Scribes Quill
VITE_APP_VERSION=1.0.0
```

---

## 📚 Example Component Pattern

```typescript
// src/components/session/NoteEditor.tsx
import { useRoom } from '@liveblocks/react/suspense'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'

const NoteEditor = () => {
  const { room } = useRoom()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({ document: room.doc }),
      CollaborationCursor.configure({ provider: room }),
    ]
  })

  return (
    <div className="prose max-w-none">
      {editor?.commands.setContent(editor.content)}
    </div>
  )
}
```

---

## 🏷️ Naming Conventions

- **Components:** PascalCase (`NoteEditor`, `CampaignList`)
- **Files:** PascalCase for components, kebab-case for utilities
- **Functions:** camelCase (`handleSave`, `formatDate`)
- **Constants:** UPPER_SNAKE_CASE (`TAG_COLORS`)
- **Database:** snake_case (`session_notes`, `campaign_members`)
- **Types:** PascalCase (`User`, `Campaign`, `SessionNote`)

---

*Updated: March 2026*
