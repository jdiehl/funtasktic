# Funtasktic Project Structure

## Directory Organization

```
funtasktic/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # App Router root layout
│   │   ├── page.tsx             # App Router home page
│   │   ├── globals.css          # Global styles
│   │   └── favicon.ico
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── admin.ts          # Firebase Admin SDK initialization
│   │   │   └── client.ts         # Firebase Client SDK initialization
│   │   ├── types/
│   │   │   └── firestore.ts      # Firestore document types
│   │   ├── auth/
│   │   │   └── middleware.ts     # Auth verification and authorization
│   │   ├── recurrence/
│   │   │   ├── recurrence.ts     # Recurrence calculation engine
│   │   │   └── recurrence.test.ts # Colocated unit tests
│   │   └── firestore/            # Firestore client utilities (TBD)
│   ├── pages/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── session.ts   # Session management
│   │   │   ├── users/
│   │   │   │   └── bootstrap.ts # First-run user setup
│   │   │   ├── lists/           # List CRUD routes (TBD)
│   │   │   ├── invitations/     # Invitation routes (TBD)
│   │   │   └── README.md        # API route documentation
│   │   └── README.md             # Legacy Pages TODO notes
│   ├── components/              # Shared React components (TBD)
│   │   ├── AuthProvider.tsx
│   │   └── README.md
│   ├── hooks/
│   │   ├── useAuth.ts           # Auth context hook
│   │   └── useList.ts           # List subscription hook
│   ├── public/
│   │   ├── file.svg
│   │   ├── globe.svg
│   │   ├── next.svg
│   │   ├── vercel.svg
│   │   └── window.svg
│   └── config/                  # Configuration files (TBD)
├── .env.local.example           # Environment variables template
├── eslint.config.mjs            # ESLint flat config
├── .gitignore                  # Git ignore file (updated)
├── tsconfig.json               # TypeScript configuration
├── vitest.config.ts            # Vitest testing configuration
├── vitest.setup.ts             # Vitest setup/teardown
├── next.config.ts              # Next.js configuration
├── firebase.json               # Firebase project configuration
├── firestore.rules             # Firestore security rules (updated)
├── firestore.indexes.json      # Firestore composite indexes (updated)
├── package.json                # Dependencies and scripts (updated)
└── PROJECT_BRIEF.md            # Product requirements
```

## Key Files Generated

### Configuration
- **tsconfig.json** — TypeScript compiler options with path aliases (@/*)
- **vitest.config.ts** — Vitest testing framework setup
- **vitest.setup.ts** — Firebase emulator environment variables
- **eslint.config.mjs** — Linting rules (flat config)
- **next.config.ts** — Next.js build and runtime config
- **.env.local.example** — Environment variables template (copy to .env.local)

### Firebase
- **firestore.rules** — Read-only clients, membership-based access control
- **firestore.indexes.json** — Composite indexes for queries from brief
- **src/lib/firebase/admin.ts** — Admin SDK (server-side)
- **src/lib/firebase/client.ts** — Client SDK (browser-side)

### Types & Auth
- **src/lib/types/firestore.ts** — All collection document types
- **src/lib/auth/middleware.ts** — Auth token verification and list membership checks

### Business Logic
- **src/lib/recurrence/recurrence.ts** — Recurrence calculation engine
- **src/lib/recurrence/recurrence.test.ts** — Recurrence tests

### API Routes (Started)
- **src/pages/api/auth/session.ts** — Session cookie management
- **src/pages/api/users/bootstrap.ts** — Idempotent first-run user setup

### Hooks
- **src/hooks/useAuth.ts** — Auth context provider and hook
- **src/hooks/useList.ts** — Real-time list subscription

## Setup Checklist

- [x] Firebase Admin/Client SDKs configured
- [x] Firestore security rules (read-only clients, membership-based)
- [x] Firestore composite indexes from brief
- [x] TypeScript configuration with Next.js
- [x] Vitest and ESLint configured
- [x] Auth middleware (token verification, membership checks)
- [x] Recurrence calculation logic
- [x] Session management API route
- [x] User bootstrap API route
- [x] Auth context hook
- [x] List subscription hook
- [x] App Router baseline (`src/app/layout.tsx`, `src/app/page.tsx`)
- [x] Environment variables file present (`.env.local`)
- [x] Emulator environment variables configured (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`)
- [ ] Frontend feature pages/components beyond starter scaffold
- [ ] Remaining API routes (Backend API Agent)
- [ ] Comprehensive tests (QA Testing Agent)

## Next Steps

1. Invoke **Funtasktic Backend API Agent** to implement remaining API routes
2. Invoke **Funtasktic Frontend React Agent** to implement pages and components
