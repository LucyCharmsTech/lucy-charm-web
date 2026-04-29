# Lucy Charm Web

A real estate web platform built with [Next.js](https://nextjs.org), Zustand, and a typed Axios service layer.

---

## Getting Started

Follow these steps **in order** every time you set up the project on a new machine or after a fresh clone.

### 1. Clone the repository

```bash
git clone <repository-url>
cd lucy-charm-web
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```bash
touch .env.local
```

Then open it and add the following:

```env
# Backend API base URL (no trailing slash)
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

> For staging/production, replace the value with the appropriate backend URL before deploying.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app hot-reloads on every file save.

### 5. Lint the codebase (optional but recommended before committing)

```bash
npm run lint
```

### 6. Build for production (optional, to verify the build locally)

```bash
npm run build
npm run start
```

> `npm run build` will **fail** if there are any TypeScript errors or unused variables — fix all warnings before deploying to Vercel.

---

## Project Structure

```
lucy-charm-web/
├── app/               # Next.js App Router pages and layouts
├── components/        # Shared UI components (one file per component)
├── stores/            # Zustand state stores (one file per domain)
├── services/          # API service functions (one file per domain)
└── lib/
    └── axios.ts       # Shared Axios instance with interceptors
```

---

## State Management — Zustand

This project uses **Zustand v5** for client-side state management.

### Conventions

| Rule                        | Detail                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| One store per domain        | e.g. `stores/authStore.ts`, `stores/listingStore.ts`                   |
| Always type the state       | Define a TypeScript `interface` for every store                        |
| Colocate actions            | Actions (`set`, async thunks) live inside the store, not in components |
| Apply `devtools` middleware | Wrap every store so state is inspectable in Redux DevTools             |
| Use `"use client"`          | Any component that consumes a Zustand hook must be a Client Component  |

### Store template

```ts
// stores/exampleStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ExampleState {
  items: Item[];
  loading: boolean;
  error: string | null;
  fetchItems: () => Promise<void>;
}

export const useExampleStore = create<ExampleState>()(
  devtools((set) => ({
    items: [],
    loading: false,
    error: null,
    fetchItems: async () => {
      set({ loading: true, error: null });
      try {
        const res = await getItems(); // imported from services/
        set({ items: res.data, loading: false });
      } catch (err) {
        set({ error: 'Failed to load items', loading: false });
      }
    },
  })),
);
```

### Consuming a store in a component

```tsx
// components/ExampleList.tsx
'use client';

import { useEffect } from 'react';
import { useExampleStore } from '@/stores/exampleStore';

export default function ExampleList() {
  const { items, loading, fetchItems } = useExampleStore();

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (loading) return <p>Loading…</p>;

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

**Key points:**

- Always destructure only what the component needs — this avoids unnecessary re-renders.
- Never call API functions directly inside components. Go through the store action instead.
- For derived/computed values, use a selector: `const count = useExampleStore((s) => s.items.length)`.

---

## API Layer

All HTTP communication flows through a single pipeline:

```
Component → Store action → Service function → lib/axios.ts → Backend
```

### Axios instance — `lib/axios.ts`

A single, shared Axios instance is configured in `lib/axios.ts`. **Never create a new `axios.create()` anywhere else in the codebase.**

Features of the shared instance:

| Feature             | Implementation                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Base URL            | `NEXT_PUBLIC_API_URL` env var, falls back to `http://localhost:8000/api/v1`                           |
| Auth token          | Request interceptor reads `localStorage.getItem('token')` and injects `Authorization: Bearer <token>` |
| SSR safety          | `typeof window !== 'undefined'` guard prevents `localStorage` access on the server                    |
| Global 401 handling | Response interceptor catches 401s for centralised session expiry logic                                |
| Timeout             | 10 000 ms                                                                                             |

### Service layer — `services/`

Each domain gets its own service file. Service functions are thin wrappers around the shared `api` instance — they should contain no business logic.

```ts
// services/listingService.ts
import api from '@/lib/axios';
import { Listing } from '@/types/listing';
import { AxiosResponse } from 'axios';

export const getListings = (): Promise<AxiosResponse<Listing[]>> =>
  api.get('/listings');

export const getListingById = (id: string): Promise<AxiosResponse<Listing>> =>
  api.get(`/listings/${id}`);

export const createListing = (
  payload: Partial<Listing>,
): Promise<AxiosResponse<Listing>> => api.post('/listings', payload);

export const updateListing = (
  id: string,
  payload: Partial<Listing>,
): Promise<AxiosResponse<Listing>> => api.patch(`/listings/${id}`, payload);

export const deleteListing = (id: string): Promise<AxiosResponse<void>> =>
  api.delete(`/listings/${id}`);
```

**Rules:**

- Always import from `@/lib/axios`, never from `axios` directly.
- Always type both the request payload and the response with TypeScript generics.
- Service functions must be pure — no `set`, no `useStore`, no side effects.
- Use `api.patch` for partial updates (soft-delete compatible). Avoid `PUT` unless the backend explicitly requires it.

### Environment variables

| Variable              | Required | Description                                                           |
| --------------------- | -------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Yes      | Base URL of the backend API (e.g. `https://api.lucycharm.com/api/v1`) |

---

## Deploy on Vercel

Set `NEXT_PUBLIC_API_URL` in your Vercel project environment settings, then deploy:

```bash
vercel --prod
```

See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for further details.
