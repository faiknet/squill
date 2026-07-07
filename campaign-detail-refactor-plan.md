# Campaign Detail Refactor

Replace the campaign "Edit" button with a GM Settings page (streak cadence) and inline pencil editing for name/description.

---

## Changes

### 1. New: `src/pages/CampaignSettings.jsx`

GM-only settings page at `/campaigns/:campaignSlug/settings`. Bento tile with streak cadence select + Save. Calls `update_campaign_as_gm_with_streak`. Guest mode disabled.

### 2. Edit: `src/routes/index.jsx`

Add lazy import + route for CampaignSettings inside the Layout block.

### 3. Edit: `src/pages/CampaignDetail.jsx`

- **Remove**: `editingCampaign`, `campaignStreakCadence`, `campaignSaving` state; `handleToggleEditCampaign`, `handleSaveCampaign`; edit form Card (~L781-842)
- **Replace Edit btn**: cog icon → `navigate(/campaigns/${slug}/settings)`
- **Name pencil**: toggle `<h1>` ↔ `<Input>` + Save/Cancel
- **Description pencil**: toggle `<p>` ↔ `<textarea>` + Save/Cancel
- **Guest**: inline edits save to sessionStorage

---

## Reuse

- `update_campaign_as_gm_with_streak` RPC for all saves
- `campaignName`/`campaignDescription` state as draft values
- Ghost button + SVG pattern from existing session actions
