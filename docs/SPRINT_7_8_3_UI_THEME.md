# Sprint 7.8.3 - UI Theme Refresh

## Theme

Royal Sufficiency Edition

เป้าหมายคือให้ระบบ PWTKSE v2 ดูเป็นระบบสารสนเทศโรงเรียนที่ทางการ อบอุ่น ใช้งานง่าย และเหมาะกับการใช้งานจริงในโรงเรียน

## Color Palette

- Primary Forest Green: `#1B5E20`
- Primary Strong: `#154A19`
- Royal Gold: `#C9A227`
- Warm Yellow: `#F4E7A1`
- Deep Red: `#8B1E1E`
- Emerald: `#2E7D32`
- Background Cream: `#FAF8F2`
- Card Surface: `rgba(255, 255, 255, 0.92)`

## Typography

- Primary body font: `Anuphan`
- Heading/accent font: `Kanit`
- Material Symbols Rounded is loaded once in the global font import for UI icon accents.
- Heading weight: 700 where appropriate
- Body weight: 400
- Button weight: 500

## Components

### Header

- Dark forest green background
- Gold school/system accents
- School logo and system name are first-class visual signals
- User summary and logout action are grouped on the right on desktop and stacked on mobile

### Login

- Cream-to-light-green page background
- School banner remains prominent
- Login/register card uses a soft glass surface with blur, shadow, and 28px radius
- Subtle school watermark can be disabled by setting `--watermark-opacity: 0`

### Buttons

- Primary: forest green
- Secondary: royal gold
- Danger: deep red
- Hover state lifts and scales slightly
- Focus ring uses royal gold for keyboard accessibility

### Cards

- 18px radius
- Soft shadow: `0 8px 24px rgba(0,0,0,.06)`
- Hover lift: 4px
- Menu cards use a gold left accent and Material Symbols icon block

### KPI Cards

- Larger icon area
- Larger number typography
- Green success and gold warning language
- Equalized card feel through minimum height and grid alignment

### Tables

- Header uses dark green with white text
- Striped rows
- Warm yellow hover state
- Table containers remain horizontally scrollable on small screens

### Forms

- Inputs use 48px+ height
- 2px border
- Gold focus state
- Muted placeholder color

## Layout

- Mobile-first shell is preserved
- Dashboard/menu cards use 24px spacing on wider screens
- No workflow routes or business logic were changed
- Existing horizontal table scroll behavior remains intact

## Responsive

Target breakpoints:

- Mobile: 390px
- Tablet: 768px
- Desktop: 1200px+

Header and action areas collapse to single-column layout on small screens.

## Accessibility

- High contrast dark green header with gold/white text
- Keyboard focus ring applied to buttons, links, and form controls
- Hover animations are reduced when `prefers-reduced-motion: reduce` is enabled
- Text wrapping is preserved for Thai labels and long user data

## Performance

- No new JavaScript UI library was added
- No new image asset was added
- Fonts are loaded through a single CSS import
- Existing optimized school logo and banner continue to be used

## Future Dark Theme

Dark mode is not implemented in this sprint. A placeholder media query and CSS variable hook are present so a future dark theme can be layered without restructuring components.

## Notes

The watermark uses a very low-opacity Material Symbols school mark rather than adding a new large image asset. It can be turned off globally by overriding:

```css
:root {
  --watermark-opacity: 0;
}
```
