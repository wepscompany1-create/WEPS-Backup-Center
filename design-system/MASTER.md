# WEPS Backup Center — Design System Master

> **المصدر الرسمي للواجهة.** كل صفحة ولوحة وحالة يجب أن تتبع هذه القواعد.
> عند بناء صفحة محددة، تحقق أولاً من `design-system/weps-backup-center/pages/[page].md`.
> إن وُجدت، قواعد الصفحة تتجاوز هذا الملف. وإلا التزم بما يلي.

---

**Project:** WEPS Backup Center  
**Product:** Enterprise Infrastructure / Database Administration / SaaS Admin Dashboard  
**Language:** Arabic-first, RTL  
**Generated with:** UI UX Pro Max (Minimalism & Swiss Style, variance 2, motion 2, density 8)

---

## 1. Product intent

لوحة تشغيل داخلية حساسة لإدارة نسخ PostgreSQL. التصميم هادئ، واضح، كثيف بما يكفي للبيانات، بلا زخرفة.

- احترافي ووظيفي.
- لا تدرجات لونية.
- لا حركات مبالغ فيها.
- الحالة تُقرأ بالنص + اللون + الأيقونة معاً.
- العربية هي اللغة الوحيدة الظاهرة للمستخدم.

**اسم المنتج:** WEPS Backup Center  
**الوصف:** مركز إدارة النسخ الاحتياطية لقواعد البيانات

---

## 2. Style

**Minimalism & Swiss Style**

- شبكة واضحة، حدود رفيعة، مساحات هادئة.
- نصف قطر صغير (`6px` للبطاقات، `4px` للأزرار والحقول).
- ظلال خفيفة جداً أو بدون ظل.
- أيقونات Lucide فقط — ممنوع الإيموجي كعنصر واجهة.

**تجنّب:** Glassmorphism، التدرجات، الحركة المعقدة، الخلفيات المزخرفة، الظلال العميقة.

---

## 3. Color palette

### Light mode

| Role | Hex | CSS variable |
|------|-----|----------------|
| Primary | `#1E293B` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#475569` | `--color-secondary` |
| Accent / success action | `#15803D` | `--color-accent` |
| On Accent | `#FFFFFF` | `--color-on-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#0F172A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Muted | `#F1F5F9` | `--color-muted` |
| Muted foreground | `#475569` | `--color-muted-foreground` |
| Border | `#E2E8F0` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#1E293B` | `--color-ring` |
| Sidebar | `#0F172A` | `--color-sidebar` |
| Sidebar foreground | `#E2E8F0` | `--color-sidebar-foreground` |

### Dark mode

| Role | Hex |
|------|-----|
| Background | `#0B1220` |
| Foreground | `#F8FAFC` |
| Card | `#111827` |
| Muted | `#1E293B` |
| Muted foreground | `#94A3B8` |
| Border | `#334155` |
| Primary | `#E2E8F0` |
| Accent | `#22C55E` |
| Destructive | `#F87171` |
| Sidebar | `#020617` |

### Status colors (both modes)

Use text + badge + icon. Never color alone.

| Status | Light | Dark | Arabic label |
|--------|-------|------|--------------|
| Success | `#15803D` | `#4ADE80` | ناجح |
| Failed | `#DC2626` | `#F87171` | فشل |
| Running | `#2563EB` | `#60A5FA` | قيد التنفيذ |
| Pending | `#64748B` | `#94A3B8` | قيد الانتظار |
| Interrupted | `#A16207` | `#FBBF24` | انقطعت |
| Valid | `#15803D` | `#4ADE80` | صالح |
| Invalid | `#DC2626` | `#F87171` | غير صالح |
| Warning | `#B45309` | `#FBBF24` | تحذير |
| Connected | `#15803D` | `#4ADE80` | متصل |
| Offline | `#DC2626` | `#F87171` | غير متصل |
| Disk warning ≥80% | `#B45309` | `#FBBF24` | تحذير المساحة |
| Disk critical ≥90% | `#DC2626` | `#F87171` | حرج |

---

## 4. Typography

Arabic UI requires a font with complete Arabic coverage.

| Role | Font |
|------|------|
| UI / body / headings | IBM Plex Sans Arabic |
| Data, IDs, hashes, sizes, times | IBM Plex Mono |

Weights: 400 (body), 500 (labels), 600 (headings / buttons).

Scale (dense dashboard):

| Token | Size | Line height | Use |
|-------|------|-------------|-----|
| `--text-xs` | 12px | 16px | meta, badges |
| `--text-sm` | 13px | 20px | table cells, helper |
| `--text-base` | 14px | 22px | body |
| `--text-lg` | 16px | 24px | card titles |
| `--text-xl` | 20px | 28px | page titles |
| `--text-2xl` | 24px | 32px | dashboard numbers |

Numbers, SHA-256, file names, durations: `font-mono`, `dir="ltr"` inside RTL layout, `text-left`.

---

## 5. Spacing and density

Dashboard density 8/10.

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |

- Page padding: 16px mobile, 24px desktop.
- Card padding: 16px.
- Table cell padding: 8px 12px.
- Sidebar width: 260px.
- Header height: 56px.

---

## 6. RTL layout

- Root: `lang="ar"` `dir="rtl"`.
- Sidebar on the right.
- Primary actions start from the right.
- Logical properties only (`ms`/`me`/`ps`/`pe`, `start`/`end`).
- Dates formatted for `ar` locale in `Asia/Aden`.
- Technical tokens (SHA-256, filenames, versions) stay LTR.

---

## 7. Components

### Buttons

- Primary: solid slate (`#1E293B`), white text. Main action per view.
- Secondary: outline, muted.
- Destructive: red, used only after confirmation.
- Ghost: icon buttons in header.
- Disabled: 50% opacity, `cursor-not-allowed`, visible reason nearby.
- Height: 36px default, 32px compact table actions.
- `cursor-pointer` on every clickable control.
- Transition: color/background 150ms. No scale bounce.

### Cards

- White/dark card on slate background.
- 1px border, radius 6px.
- Title 16px/600 + optional meta.
- Status cards: label, large value, short helper.

### Tables

- Header muted background, 12px/500.
- Row hover: muted fill.
- Actions column: icon buttons with Arabic `aria-label`.
- Mobile: horizontal scroll with sticky first column, or stacked cards under 768px.

### Forms

- Labels above fields, 13px/500.
- Helper text muted.
- Error: red text + `aria-invalid` + `aria-describedby`.
- Time input: `HH:mm`.
- Email: LTR input inside RTL form.

### Dialogs

- Centered, max-width 480px.
- Destructive dialogs require typing `حذف`.
- Restore Test dialog explains: temporary database will be created then dropped.
- Production Restore uses a multi-step destructive dialog. It shows backup number/date/size/SHA-256/Restore Test result, defaults to candidate-only, requires acknowledgement + exact phrase + backup number + password re-auth, and clearly states that this first action cannot cut over production.
- Cutover and previous-database deletion each use a separate dialog with fresh re-authentication and their own exact phrase. Never reuse confirmation state between actions.
- Focus trap, Escape closes, return focus to trigger.

### Badges

- Pill, 12px, with icon.
- Success / failed / running / pending / interrupted / valid / invalid.

### Toast

- Bottom-start in RTL.
- Not the only feedback for long jobs — page status must update too.

### Skeleton

- Muted pulse for cards and table rows.
- Respect `prefers-reduced-motion` (static placeholder).

---

## 8. Navigation

Sidebar (right):

1. الرئيسية
2. النسخ الاحتياطية
3. اختبارات الاستعادة
4. سجل التدقيق
5. الإعدادات

Footer of sidebar: system health, signed-in email, logout.

Header: product name, system status, theme toggle, admin menu.

---

## 9. Motion

- 150–200ms color/opacity only.
- No page transitions, no parallax, no staggered reveals.
- `prefers-reduced-motion: reduce` disables pulse/spinner animation.

---

## 10. Light / Dark

- First visit: system preference.
- Persist in `localStorage` via `next-themes` (`attribute="class"`).
- No FOUC: `suppressHydrationWarning` on `<html>`, ThemeProvider with `disableTransitionOnChange`.
- Status colors remain distinguishable in both modes (WCAG AA).

---

## 11. Accessibility

- Keyboard order follows visual RTL order.
- Visible focus ring 2px (`--color-ring`).
- Icon-only buttons have Arabic `aria-label`.
- Dialogs use `role="dialog"` and labelled title.
- Contrast ≥ 4.5:1 for text.
- Do not rely on color alone.
- Touch targets ≥ 44px on mobile.

---

## 12. Responsive

| Breakpoint | Layout |
|------------|--------|
| 375px | stacked, drawer sidebar |
| 768px | two-column cards, scrollable tables |
| 1024px | sidebar + content |
| 1440px | max content width 1280px |

---

## 13. Empty / loading / error / disabled

| State | Pattern |
|-------|---------|
| Loading | Skeletons matching final layout |
| Empty | Short Arabic sentence + primary action if allowed |
| Error | Arabic message + reference ID, no stack trace |
| Disabled | Button disabled + reason (عملية قيد التنفيذ / إعداد ناقص) |
| Success | Badge + toast + inline status |

---

## 14. Copy (Arabic)

Use these terms consistently:

- النسخ الاحتياطية
- النسخ التلقائي / النسخ اليدوي
- اختبار الاستعادة
- سلامة النسخة
- قاعدة البيانات الأساسية
- مساحة التخزين
- سجل التدقيق
- إعدادات التنبيهات
- العملية قيد التنفيذ
- فشلت العملية
- اكتملت العملية بنجاح
- متصل / غير متصل
- صالح / غير صالح

Technical terms may appear beside Arabic: Backup, Restore, PostgreSQL, SHA-256, AES-256-GCM.

Restore safety notice (always visible on backups/dashboard):

> اختبار الاستعادة يفحص النسخة في قاعدة مؤقتة. استعادة الإنتاج تنشئ قاعدة مرشحة منفصلة، ولا تستبدل بيانات الإنتاج إلا بعد خطوة تبديل مستقلة ومؤكدة.

Production Restore status copy:

- قاعدة الاستعادة جاهزة للتبديل
- يلزم تبديل رابط قاعدة البيانات خارجياً
- التراجع متاح حتى [وقت]
- يلزم تدخل فوري لإكمال التراجع
- انتهت مدة الاحتفاظ؛ الحذف اليدوي متاح

`ROLLBACK_REQUIRED` and `AWAITING_EXTERNAL_CUTOVER` require a persistent inline banner plus status badge; a toast alone is insufficient. Database names, hashes, IDs, and times are LTR/monospace. Do not show URLs, passwords, keys, dump paths, or raw PostgreSQL errors.

---

## 15. Pre-delivery checklist

- [ ] No emoji icons
- [ ] `cursor-pointer` on clickable elements
- [ ] Hover 150–200ms
- [ ] Text contrast ≥ 4.5:1
- [ ] Visible focus
- [ ] `prefers-reduced-motion`
- [ ] RTL unbroken at 375 / 768 / 1024 / 1440
- [ ] No secrets in UI
- [ ] Restore Test and Production Restore controls are visually and semantically distinct
- [ ] Production Restore defaults to candidate-only
- [ ] Cutover is a second independent confirmation with re-auth
- [ ] No UI action implies production DROP/terminate or automatic previous deletion
