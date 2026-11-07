# Smart Library Platform — Frontend

React + TypeScript + Vite client for the Smart Library Platform API. It uses
React Router for routes, Zustand with browser local-storage persistence for
JWT-backed auth state, Axios for API requests, and TanStack Query for server
state. Logout clears local auth and query-cache state; token revocation occurs
server-side only when a password changes or resets.

## Application areas

- `/login` — sign-in
- `/dashboard` — role-specific dashboard
- `/catalog/*` — books, authors, categories, publishers, and languages
- `/circulation/*` — student loans/reservations/fines and staff circulation
- `/admin/*` — admin user, department, and circulation-policy management

Route guards control navigation for user experience; backend role checks are
authoritative. The books catalog includes optional semantic search. Staff return
search is server-side and paginated.

## Local development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The app runs at `http://localhost:5173` and expects the backend at `VITE_API_BASE_URL`.

If `VITE_API_BASE_URL` is unset, the API client defaults to
`http://localhost:8000/api/v1`.

## Checks

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:watch
```

Frontend component tests use Vitest, React Testing Library, and jsdom. The suite
covers catalog search pagination, dashboard activity counts and accessible table
labels, and request-specific retry behavior.

GitHub Actions installs the pnpm 12.18.0 version pinned in `package.json`.
