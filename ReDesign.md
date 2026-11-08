# ETC LegalHub — SaaS UI & Design System Guidelines

When creating or modifying frontend code (`frontend/src/**`) in this repository, always adhere strictly to the **ETC LegalHub SaaS Design System**:

## 1. Design Philosophy
- **Clean · Minimal · Modern · Professional · Elegant**
- *Less decoration, more clarity. Less noise, more intelligence.*
- **Strictly Forbidden**:
  - Do NOT use emojis (`📊`, `🗺️`, `🚪`, `🏭`, `💧`, `🗑️`, `✏️`, `➕`, `📋`, `⚡`, etc.) as UI icons. Always use Tabler Outline Icons (`<i class="ti ti-..."></i>`).
  - Do NOT use neon glows, glassmorphism, neumorphism, heavy drop shadows, or multi-color purple/blue gradients.
  - Do NOT use `Playfair Display` or serif fonts. Use `Be Vietnam Pro` across all headings, body text, and controls.
  - Do NOT alter business logic, API endpoints, classification rules, QCVN formulas, or authentication/authorization flows when updating UI.

## 2. Color Palette (CSS Variables)
- **Main Background (`--bg`)**: `#F6F8F6`
- **Surface / Card (`--surface`)**: `#FFFFFF`
- **Muted Surface (`--surface2`)**: `#F0F4F1`
- **Primary Green (`--accent` / `--primary`)**: `#286B4F`
- **Primary Hover (`--primary-hover`)**: `#20573F`
- **Light Green (`--accent2` / `--primary-light`)**: `#EAF3ED`
- **Heading Text (`--text`)**: `#192A21`
- **Body Text (`--text2`)**: `#526158`
- **Muted Text (`--text3`)**: `#89958D`
- **Border (`--border`)**: `#E5EBE6`
- **Semantic Status Colors**:
  - Success (`--success` / `--success-bg`): `#25845B` / `#EAF5EF`
  - Warning (`--warn` / `--warn-bg`): `#D99A38` / `#FCF6EC`
  - Danger (`--red` / `--red-bg`): `#D65B5B` / `#FDF0F0`
  - Information (`--info` / `--info-bg`): `#5681A5` / `#EFF4F8`

## 3. Component & Layout Standards
- **App Shell**: Collapsible Left Sidebar (`248px` / `68px`) + Topbar (`56px` with Breadcrumb & User Profile) + Main Workspace (`max-width: 1360px`).
- **Avoid Double Sidebars**: Secondary lists (Saved Projects, Saved Samples, Document Details) must use Top Selector Bars and Slide-over Drawers (`.drawer-overlay` + `.drawer-panel`).
- **Controls**: Unified `38px` height for inputs, selects, and standard buttons; `8px–12px` border radius; `1px solid var(--border)` borders.
- **Build Requirement**: Whenever modifying `frontend/src/**`, run `npm run build` in `frontend/` so `backend/public/` stays synchronized for Express port `3000`.
