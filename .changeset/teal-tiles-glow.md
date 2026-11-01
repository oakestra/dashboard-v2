---
'@oakestra/ui': minor
---

Oakestra brand theme and status primitives. The primary color is now the slate-teal of the logo (light and dark values, AA contrast), neutrals carry a slight cool tint, the chart palette starts with the brand, and `--radius` is 0.5rem. New tokens `success`, `warning`, `info` (each with `-foreground`) and `destructive-foreground`.

New components: `StatusBadge` and `StatusDot` with a `tone` (`success`, `warning`, `info`, `destructive`, `neutral`), `StatCard` (metric tile with icon, hint, loading state, link or button) and `SectionCard` (titled page section with an action on the right). `Badge` gains soft `success`, `warning`, `info` and `neutral` variants, and its `destructive` variant is soft now too. `Alert` gains tinted `warning`, `success` and `info` variants, and its `destructive` variant is tinted to match.

`DataTable`: column `meta` (`align`, `numeric`, `className`, `headerClassName`) for right-aligned tabular columns, sort icons only on hover or when sorted, focus styles for clickable rows, empty and no-results states with icons, and paging controls only when there is more than one short page, and clicks inside a menu or dialog opened from a cell no longer open the row. `Table` headers are quieter (small muted text) and cells a little roomier. `SidebarInset` no longer grows with wide content.
