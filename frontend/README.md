# Smart Library Platform — Frontend

React + TypeScript + Vite client for the Smart Library Platform API. It uses
React Router for routes, Zustand with browser local-storage persistence for
JWT-backed auth state, Axios for API requests, and TanStack Query for server
state. Logout clears local auth and query-cache state; token revocation occurs
server-side only when a password changes or resets.

## Application areas

- `/login` — sign-in
- `/dashboard` — role-specific dashboard
- `/notifications` — recent in-app circulation alerts and read controls
- `/catalog/*` — books, authors, categories, publishers, and languages
- `/circulation/*` — student loans, renewals, reservations/fines, and staff circulation
- `/admin/*` — admin user, department, circulation-policy, and semantic-search index management

Route guards control navigation for user experience; backend role checks are
authoritative. The books catalog includes optional semantic search. Staff return
search is server-side and paginated.
Staff can print a copy label or all labels for a book from its detail page. Issue
and return forms can scan those QR labels; scanning filters the existing list and
does not bypass the usual eligibility checks or confirmation. Labels encode the
copy inventory code and are generated in the browser. Camera use needs permission
and HTTPS (localhost is allowed); manual search remains available.

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

Frontend component tests use Vitest, React Testing Library, and jsdom. Current
coverage includes login and route behavior, catalog search and responsive views,
circulation issue/return and student loans/reservations/fines/notifications, dashboard counts,
admin search-index controls, formatting, and query error/retry behavior. API
services are mocked in component tests; this suite does not replace a browser
workflow against a running backend and database.

GitHub Actions installs the pnpm 12.18.0 version pinned in `package.json`, then
runs lint, tests, and a type-checked production build.
