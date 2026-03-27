# Scribe's Quill - UI/UX Style Guide

**Version:** 1.0.0
**Last Updated:** March 2026
**Framework:** React + Tailwind CSS

---

## 1. Design Philosophy
Scribe's Quill adopts a **distraction-free, content-first** aesthetic inspired by modern documentation tools. The interface prioritizes readability, high contrast in dark mode, and a "clean" look with sharp corners and subtle dividers.

- **Visual Style:** Minimalist, flat, sharp corners (`rounded-none` default).
- **Dark Mode:** Deep, OLED-friendly grays with specific high-contrast borders.
- **Brand Identity:** Professional, grounded, utilizing a distinctive Teal accent.

---

## 2. Color System

### 🎨 Brand Palette
The primary brand color is **Teal**.

| Token | Hex | Usage |
|-------|-----|-------|
| `brand-50` | `#eaf4f4` | Subtle backgrounds (light mode) |
| `brand-500`| `#307473` | **Primary Brand Color** (Focus rings, icons, accents) |
| `brand-600`| `#265d5c` | Interactive buttons, active states |
| `brand-700`| `#1c4645` | Hover states |

### 🌗 Neutral / Semantic Palette (Dark Mode Optimized)
The `gray` (and aliased `slate`/`zinc`) palette has been customized for a specific dark mode feel.

| Token | Hex | Role |
|-------|-----|------|
| `gray-50` | `#f9f9f9` | App Background (Light) |
| `gray-100`| `#ececec` | Surface Background (Light) |
| `gray-700`| `#2d2e30` | **Borders (Dark)** - *Custom contrast shade* |
| `gray-800`| `#1e1f20` | **Surface / Cards (Dark)** |
| `gray-900`| `#131314` | **App Background (Dark)** |
| `white` | `#ffffff` | Surface (Light), Text (Dark) |

---

## 3. Typography

**Font Family:** `Inter`, sans-serif

| Element | Class | Size | Weight | Tracking |
|---------|-------|------|--------|----------|
| **Page Title** | `text-2xl` | 24px | Bold (700) | `tracking-tight` |
| **Section Header** | `text-lg` | 18px | Bold (700) | Normal |
| **Table Header** | `text-xs` | 12px | Semibold (600) | `tracking-wider` (Uppercase) |
| **Body Text** | `text-base` | 16px | Normal (400) | Normal |
| **UI Label** | `text-sm` | 14px | Medium (500) | Normal |

---

## 4. Components

### Buttons
Sharp corners, flat design.

*   **Primary:** `bg-brand-600 text-white hover:bg-brand-700`
*   **Ghost/Secondary:** `text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700`
*   **Icon Button:** `p-2 rounded-full hover:bg-slate-100 dark:hover:bg-gray-700`

### Inputs
*   **Background:** `bg-white dark:bg-gray-950`
*   **Border:** `border-slate-200 dark:border-gray-700`
*   **Focus:** `focus:ring-2 focus:ring-brand-500 focus:border-transparent`
*   **Text:** `text-gray-900 dark:text-gray-100`

### Cards & Modals
*   **Light Mode:** `bg-white border-slate-200 shadow-sm`
*   **Dark Mode:** `bg-gray-800 border-gray-700 shadow-none`
*   **Radius:** Standard Tailwind rounded classes are overridden to **0px** (sharp) generally, though specific UI elements like buttons in lists may use `rounded-md`.

### Navigation (Sidebar)
*   **Container:** `w-60 border-r border-slate-200 dark:border-gray-700`
*   **Active Item:** `bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 border-l-2 border-brand-600`
*   **Inactive Item:** `hover:bg-slate-50 dark:hover:bg-gray-800`

### Form Sections
Organize complex forms into distinct cards.

*   **Container:** `bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm`
*   **Header:** `border-b border-slate-200 dark:border-gray-700 p-6` containing Title (`text-lg font-bold`) and Description (`text-sm text-slate-500`).
*   **Body:** `p-6 space-y-6` containing inputs and action buttons.

---

## 5. Layout & Spacing

*   **Global Padding:** `p-4` or `p-6` for main content areas.
*   **Header Height:** `h-16` (64px).
*   **Grid Gaps:** Standardized on `gap-4` (16px) or `gap-6` (24px).
*   **Max Widths:** `max-w-7xl` for dashboard content, `max-w-screen-xl` for editor.

---

## 6. Iconography
*   **Library:** Heroicons (Outline v2).
*   **Size:** Standard icon size is `size-4` (16px) or `size-5` (20px).
*   **Stroke:** `strokeWidth={2}` for clarity.
*   **Logo:** `src/components/ui/logo.webp` used in Sidebar (Size `size-8`).

---

## 8. Responsive Design

Scribe's Quill follows a "Mobile-First" or "Adaptive" strategy where complex data views (like tables) adapt to card-based layouts on smaller screens.

### Breakpoints
*   **Mobile (`< md`):** Single column layout, hidden sidebars, card views.
*   **Desktop (`>= md`):** Multi-column layout, persistent sidebars, table views.

### Navigation Patterns
*   **Desktop:** Persistent Sidebar (`w-60`).
*   **Mobile:** Off-canvas Drawer (Slide-over) triggered by a hamburger menu.
    *   **Overlay:** `fixed inset-0 bg-black/50 z-20`
    *   **Drawer:** `fixed inset-y-0 left-0 w-64 z-30 transform transition-transform`

### Data Display Patterns
*   **Tables (Desktop):** Use for dense data. Hide on mobile (`hidden md:table`).
*   **Cards (Mobile):** Use for touch-friendly lists. Hide on desktop (`md:hidden`).
    *   **Card Structure:**
        *   Header: Title + Status/Icon
        *   Body: Description (truncated)
        *   Footer: Metadata (stats, dates) + Actions

---

## 9. Dark Mode Implementation Guide

When adding new components, follow this pattern for strict compatibility:

```jsx
<div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
  <h3 className="text-slate-900 dark:text-gray-100">Title</h3>
  <p className="text-slate-500 dark:text-gray-400">Content</p>
</div>
```

**Critical Rules:**
1.  NEVER use `border-gray-800` in dark mode. It is invisible against the card background. Use **`border-gray-700`**.
2.  Inputs must have `dark:bg-gray-950` to distinguish them from the `gray-800` modal background.
