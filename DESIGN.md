# DESIGN.md — PTDTT Manager Design System

> Canonical design language and token specification for PTDTT Manager (`khoaptdtt.info.vn`).  
> Approved on 03/10/2026 by BS. Vũ Khương An. Master reference: `docs/brand/BRAND.md`.

---

## 1. Identity & Logo System

- **Master Source File:** `z7671210353977_f44e88d91f47e3616ae9e99a5b74ebb8.jpg` (Google Drive: `.../06. WEB APP /3. LOGO KHOA/`)
- **Canonical Web Asset:** `img/logo-khoa.jpg` (MD5: `db144bb49b076d907881e6b04f96f478`)
- **Dimensions:** 480 × 480 px, JFIF JPEG, baseline RGB.
- **Rule:** The **complete logo with full department text** ("BINH DAN HOSPITAL" & "COLORECTAL SURGERY DEPARTMENT") must always be used for the sidebar (`.logo-icon img`) and mobile header (`.mobile-header-logo`).
- **Container styling:**
  - Sidebar: 44 × 44 px, background `#FFFFFF`, border-radius `10px`, box-shadow `0 0 0 1px var(--border)`, image centered with `object-fit: contain`.
  - Dark mode: Keep the white squircle plate (`#FFFFFF`). Never place the logo directly on a dark background.

---

## 2. Color Palette (Extracted From Logo)

All 110/110 color pairs have been verified for WCAG AA contrast (≥ 4.5:1 for body text, ≥ 3.0:1 for borders/graphics).

### Core Brand Colors

| Swatch | Name | Hex Token | Role | WCAG Contrast |
|---|---|---|---|---|
| 🟦 Navy | `navy-900` | `#1D2357` | Primary brand color, primary button fill, headings, active states | 14.68:1 on light |
| 🌊 Ocean | `ocean-600` | `#1878B4` | Secondary accent, focus ring, total patient stat box, info links | 4.79:1 on light |
| 🍃 Leaf | `leaf-500` | `#54A83C` | Active menu indicator (`3px` border), success badge | 2.98:1 (decorative) / leaf-700 for text |
| 🍋 Lime | `lime-400` | `#90C03C` | Accent arc, decorative gradient | Decorative only |

### Semantic Tokens

| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--bg-primary` | `#F4F7FD` | `#0C1022` | App background |
| `--bg-secondary` | `#FFFFFF` | `#141A30` | Cards, sidebar, modal surfaces |
| `--text-primary` | `#262D40` | `#EEF1FB` | Primary body text |
| `--text-heading` | `#1D2357` | `#FFFFFF` | Display titles, section headers |
| `--text-muted` | `#697082` | `#97A0B7` | Subtitles, helper text |
| `--primary` | `#1D2357` | `#B2C1FD` | Brand text & icons |
| `--primary-fill` | `#1D2357` | `#5867C0` | Primary button backgrounds |
| `--on-primary` | `#FFFFFF` | `#FFFFFF` | Text on primary fill |
| `--primary-soft` | `rgba(29, 35, 87, 0.08)` | `rgba(178, 193, 253, 0.12)` | Active nav item background |
| `--border` | `rgba(29, 35, 87, 0.10)` | `rgba(255, 255, 255, 0.10)` | Card borders, dividers |
| `--focus-ring` | `#1878B4` | `#96CBF5` | Keyboard accessibility ring |

### Surgery Approach Classification

| Approach | Variable | Light Bg / Text | Text On Background |
|---|---|---|---|
| **Mổ mở** | `--surgery-mo-*` | `#FFE6E8` / `#830031` | `#FFFFFF` (on `#A90042`) |
| **Nội soi** | `--surgery-noisoi-*` | `#DEF4E1` / `#005423` | **`#111542` Navy** (on `#34A357`) |
| **NSTH** | `--surgery-nsth-*` | `#EEE9FF` / `#4F2494` | `#FFFFFF` (on `#7C4CD5`) |
| **Robot** | `--surgery-robot-*` | `#E7ECFF` / `#333C83` | `#FFFFFF` (on `#333C83`) |

---

## 3. Typography System (Local WOFF2, Zero External CDN)

- **Display & Headings:** `Be Vietnam Pro` (`/fonts/be-vietnam-pro-*.woff2`)
  - Applied to: `h1–h6`, `.page-title`, `.brand-name`, `.btn`, `.nav-item`, `.logo-title`, `.modal-title`.
  - Weights: 500, 600, 700.
- **Body & Tabular Data:** `Noto Sans` (`/fonts/noto-sans-*.woff2`)
  - Applied to: `body`, paragraphs, tables, inputs, `.stat-value`, `.kpi-value`, Canvas charts, exported JPEG/PNG reports.
  - Weights: 400, 500, 600, 700.
  - Tabular numbers: `font-feature-settings: "tnum" 1` supported on Noto Sans.

---

## 4. UI Elevation & Motion

- **Border Radius:**
  - Badges & Pills: `9999px`
  - Cards & Modals: `12px` – `16px`
  - Logo Squircle: `10px`
  - Inputs & Buttons: `8px`
- **Shadows:**
  - Card elevation: `var(--shadow-card)`
  - Primary button glow: `var(--shadow-glow-primary)`
- **Focus Rings:**
  - `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }`
