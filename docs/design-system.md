# Design system
Direction: premium, restrained sports product. No emoji, no glassmorphism, no heavy gradients.

## Colour tokens
| Token | Hex | Use |
|---|---|---|
| ink | #0B0B0C | page background |
| coal | #141416 | cards, header |
| graphite | #1E1E21 | raised surfaces, odds buttons |
| line | #2A2A2E | borders |
| fog | #8C8C93 | secondary text |
| bone | #F4F2EE | primary text |
| peach | #FFB38A | accent: selected odds, primary action, focus ring |
| peach-dim | #3A2A20 | accent surface |
| live | #FF5A4F | live indicator only |
| win / loss | #7BD389 / #FF7A7A | settlement states only |

## Type
Inter (UI), tabular numerals for odds, clocks and scores. Scale: 12 / 14 / 16 / 20 / 28 / 40.

## Shape and motion
Radius 6px (controls) and 8px (cards). 1px borders in `line`. Shadows only on overlays.
Motion 120–200ms ease-out; odds changes flash `peach-dim` once; honour `prefers-reduced-motion`.

## Components
Odds button (idle / selected / suspended / changed), match card, status pill (live / upcoming / full time), data table, state panel (loading / error / disconnected / empty).

## Accessibility
Visible 2px peach focus ring, 44px minimum touch target, odds buttons are real `<button aria-pressed>`, live regions for score changes.
