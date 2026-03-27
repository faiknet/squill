# Supabase Auth Setup Guide

## Overview

Scribe's Quill uses **Supabase Auth** as its primary authentication mechanism. This guide explains what you need to configure in the Supabase dashboard to make authentication work.

## Quick Start

1. **Create a Supabase Project**: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **Copy env vars**: Copy values from `.env` to `.env.local` (do not commit `.env`)
3. **Enable email confirmations**: Follow steps below
4. **Test auth flows**: Sign up, verify email, sign in

---

## Prerequisites

- Node.js 18+ and npm/yarn installed
- A Supabase project created and running
- `.env` file configured with your Supabase credentials

---

## Email Configuration (Required)

By default, Supabase requires email confirmation before users can sign in. This is a **security best practice** for MVP apps.

### Step 1: Enable Email Confirmations

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Email**
3. Toggle **"Enable email confirmations"** to ON
4. Choose your email provider:
   - **Supabase Email Sandbox** (recommended for testing)
   - Custom SMTP (for production)

### Step 2: Configure Email Templates (Optional)

You can customize the verification and password reset emails:

1. Still in **Project Settings** → **Email**
2. Edit the email templates if desired
3. Default templates are functional and recommended for MVP

### Step 3: Add Custom Domain (Optional)

If you want branded emails:

1. Add your custom domain in Supabase settings
2. Add DNS records (SPF, DKIM, DMARC)
3. For MVP, use Supabase's default domain

---

## Environment Variables

The `.env` file contains these Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**:
- Never commit your `.env` file to version control
- Copy `.env.example` to `.env.local` for local development
- Only share `.env.example` in repositories

---

## Auth Flow

### Sign Up Flow

1. User fills out email and password on `/auth`
2. Calls `supabase.auth.signUp()`
3. Supabase sends verification email
4. User clicks verification link
5. User can now sign in

### Sign In Flow

1. User fills out email and password on `/auth`
2. Calls `supabase.auth.signInWithPassword()`
3. If email verified: redirect to dashboard
4. If email not verified: show verification message
5. User can request verification email

### Password Reset Flow

1. User clicks "Forgot password?" on `/auth`
2. User goes to `/auth/reset-password`
3. User enters email address
4. Supabase sends password reset link
5. User clicks link and enters new password

---

## Testing

### Local Development

Use Supabase's sandbox emails for testing:

- `email@example.supabase.email`
- `test@example.supabase.email`

### Production Testing

1. Use a real email address you control
2. Check spam folder if verification email doesn't arrive
3. Test password reset flow

---

## Security Considerations

### Email Verification (MVP)

For MVP, we **require email verification** before:
- Creating a campaign
- Accessing any content
- Using real-time collaboration

This prevents:
- Sybil attacks (fake accounts)
- Spam accounts
- Unauthorized access

### Password Requirements

Supabase requires passwords to:
- Be at least 6 characters
- Not be commonly compromised
- Follow complexity rules

### Rate Limiting

Supabase automatically:
- Limits sign-in attempts (prevents brute force)
- Sends CAPTCHAs when needed
- Locks accounts after repeated failures

---

## Migration from Liveblocks Auth

**Note**: The old `useAuth` from `@liveblocks/react` is deprecated and doesn't exist in Liveblocks v2.

We've replaced it with our custom `useSupabaseAuth` hook which:
- Manages auth state with `authState`
- Provides `signIn`, `signUp`, `signOut` functions
- Handles email verification
- Supports password reset

---

## Troubleshooting

### "USER_ACCOUNT_NOT_CONFIRMED" Error

This occurs when:
- User tries to sign in with unverified email
- **Fix**: Click verification link or request a new one

### "INVALID_EMAIL_OR_PASSWORD" Error

Check:
- Email is spelled correctly
- Password is correct (case-sensitive)
- Account was created with `signUp()` not `signIn()`

### Email Not Arriving

Check:
- Spam folder
- Email provider (Gmail, Outlook, etc.)
- Supabase email settings
- Custom domain DNS records

---

## Next Steps

After auth is working:

1. **Build campaign CRUD**: Create, read, update, delete campaigns
2. **Setup database schema**: Create `campaigns` and `sessions` tables
3. **Implement real-time**: Use Liveblocks for collaborative editing
4. **Add session notes**: Create editor component with TipTap

---

## Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Email Configuration](https://supabase.com/docs/guides/auth/auth-email-configuration)
- [Liveblocks v2 Migration](https://liveblocks.io/docs/react/start/v2-migration)

---

*Last updated: March 16, 2026*
