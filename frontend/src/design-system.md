# Legacy Design System (Canonical Source of Truth)

## 1. Colors (Hex & Tokens)
**Brand Colors**
- `accent` (Cyan): `#06B6D4`
- `primary` (Indigo): `#6366F1`
- `secondary` (Purple): `#8b5cf6`

**Status Colors**
- `status-present` (Green): `#10B981`
- `status-late` (Orange): `#F59E0B`
- `status-absent` (Red): `#EF4444`

**Backgrounds**
- `bg-deep`: `#0B0F17` (The universal app background)
- `bg-panel`: `#161F30` (Used for opaque panels)
- `bg-header`: `rgba(11, 15, 23, 0.85)` (Translucent top bar)
- `glass-bg`: `rgba(255, 255, 255, 0.05)`
- `glass-border`: `#2A3854` (The standard border for ALL glass panels)
- `glass-border-bright`: `rgba(255, 255, 255, 0.22)`

**Text Colors**
- `text-main`: `#F8FAFC`
- `text-muted`: `#94A3B8`
- `text-dim`: `#64748B`

## 2. Typography
- **Main Font**: `'Outfit', sans-serif` (Weights: 300 to 900)
- **Data Font**: `monospace` or `'Space Grotesk'` (Used for stats, logos, numerical data)

**Typography Conventions (Crucial for the "Look")**
- **Labels (e.g. "BIOMETRIC_CONFIGURATION")**: `font-size: 0.7rem - 0.8rem`, `text-transform: uppercase`, `letter-spacing: 0.1em`, `font-weight: 800`, color: `var(--text-dim)`.
- **Stats/Numbers**: `font-family: var(--font-data)`, `font-size: 2.2rem`, `font-weight: 800` to `900`.

## 3. Shadows & Glows
- `accent-glow`: `rgba(6, 182, 212, 0.4)`
- `primary-glow`: `rgba(99, 102, 241, 0.3)`
- `shadow-sm`: `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08)`
- `shadow-md`: `0 24px 64px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15)`
- `shadow-lg`: `0 40px 96px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.25)`

## 4. Glassmorphic Panel Formula
To recreate the "Perfect Glass" look from the legacy app, elements must use:
- **Background**: `var(--bg-panel)` or `rgba(15, 23, 42, 0.35)` for transparent glass.
- **Backdrop Blur**: `blur(24px)`
- **Border**: `1px solid #2A3854`
- **Border Radius**: `16px` (md) or `24px` (lg)
- **Box Shadow**: `var(--shadow-md)`

## 5. UI Elements
**Premium Button (`btn-premium`)**
- Background: `linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)`
- Text: `#fff`, `font-weight: 800`, `text-transform: uppercase`, `letter-spacing: 1px`
- Border: `none`
- Shadow: `0 8px 24px rgba(99, 102, 241, 0.3)`

**Secondary Button (`btn-secondary` / `btn-glass`)**
- Background: `rgba(255, 255, 255, 0.04)`
- Border: `1px solid #2A3854`
- Text: `#fff`, `font-weight: 800`

**Inputs (Auth Style)**
- Background: `rgba(255, 255, 255, 0.04)`
- Border: `1px solid rgba(255, 255, 255, 0.1)`
- Radius: `14px`
- Padding: `16px 20px`
- Focus State: Border becomes `#06B6D4`, background becomes `rgba(0, 209, 199, 0.05)`

## 6. Background Orbs & Radial Gradients
The legacy app relies heavily on fixed background radial gradients (e.g. `radial-gradient(circle at 15% 20%, rgba(0, 209, 199, 0.08) 0%, transparent 40%)`) instead of flat colors to give depth.
