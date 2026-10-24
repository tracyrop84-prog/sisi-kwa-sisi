# Sisi kwa Sisi

A Kenyan crowdfunding website (like GoFundMe, built for harambees). Currency is KES.

Mobile-first: most users open links from WhatsApp, so design for 390px phones first.

## Stack

- Next.js (App Router) with TypeScript
- Tailwind CSS
- Supabase (database, auth, storage)
- Hosted on Vercel

## Brand (Maasai Red)

| Role | Color | Use |
|------|-------|-----|
| Primary | `#C1121F` | Donate button and key actions only |
| Accent | `#1D4ED8` | Progress bars, Verified badge, links |
| Text | `#1F1F1F` | Body text |
| Muted | `#555555` | Secondary text |
| Background | `#FAFAF7` | Page background |
| Surface | `#FFFFFF` | Cards and panels |
| Error background | `#FDE8E9` | Error messages (with a warning icon) |

- Font: Plus Jakarta Sans.
- Don't use the red for errors; show errors with a warning icon on `#FDE8E9`.
- The report button is grey.

## Rules

- Payments are MOCK for now. No real M-Pesa until told.
- Never put API keys or secrets in frontend code; use environment variables.
- Build one phase at a time and keep things simple.

## Phases

1. Campaign pages (create campaign, public page, progress bar)
2. Mock donations and donor list, WhatsApp share link
3. WhatsApp donor/progress summary
4. Campaign updates feed (gifts, recovery, progress; photos optional)
5. Report button and admin review
6. Empowerment campaigns with verification
7. Real M-Pesa (Daraja sandbox)
