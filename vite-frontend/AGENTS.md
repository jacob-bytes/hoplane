# vite-frontend

React dashboard for Hoplane. rolldown-vite + TypeScript + Tailwind v4 + shadcn/radix.

## Structure

| Dir/File | Role |
|----------|------|
| `src/App.tsx` | Routes + ProtectedRoute + H5 layout selection |
| `src/main.tsx` | Entry: ReactDOM + BrowserRouter |
| `src/api/` | Axios wrapper, sends raw JWT in `Authorization` |
| `src/pages/` | Route views (forward, node, tunnel, settings, ...) |
| `src/components/ui/` | shadcn/radix primitives |
| `src/styles/globals.css` | Base styles — **must import `tailwind-theme.pcss`** |
| `src/styles/tailwind-theme.pcss` | Tailwind v4 `@theme inline` semantic tokens |
| `vite.config.ts` | host `0.0.0.0:3000`, PWA plugin, `@` alias to `src/` |

## Conventions

- **Auth**: raw JWT in `Authorization` header — no `Bearer` prefix.
- **API envelope**: `{code, msg, data, ts}`, code 0 = success.
- **UI imports**: `src/components/ui/*` primitives plus the `src/components/*` kit (`dialog`, `select-native`, `multi-select-field`, `accordion-field`, `tabs-field`, `date-picker-field`, `progress-bar`, `radio-group-field`); never `@heroui/*` or `@nextui-org/*`.
- **Theme**: don't remove `tailwind-theme.pcss` import from `globals.css` — breaks semantic classes (`bg-primary`, `text-foreground`, `border-input`).
- **Buttons**: use `loading` for submit/save/delete in flight; it renders the spinner and disables the button.
- **Dialogs**: `components/dialog.tsx` exposes `Dialog/DialogContent/DialogHeader/DialogBody/DialogFooter` on top of `ui/dialog`; pages use this kit.

## Anti-patterns

- Don't add `Bearer` prefix to auth header.
- Don't reintroduce `@heroui/*` or `@nextui-org/*` packages.
- Don't add frontend tests (no test infrastructure).
- Don't remove `tailwind-theme.pcss` import.

## Design

- `DESIGN.md` — 视觉方向 v3「白底深蓝」：tokens、字号、间距、组件语言、动效。改 UI 前必读。
- `FRONTEND-HANDBOOK.md` — 怎么写、怎么评审、怎么合并（目录、组件、表单、动效、DoD）。
- `MIGRATION.md` — 迁移记录；HeroUI bridge 已删除。
- `prototype/design-v3.html` — 方向样张（静态 HTML，不参与构建）。

## Commands

```bash
pnpm install
pnpm run dev           # http://0.0.0.0:3000
pnpm run build         # tsc && vite build
pnpm run lint          # eslint --fix
```
