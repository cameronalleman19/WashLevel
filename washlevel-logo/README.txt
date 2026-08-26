WashLevel logo files
====================
Accent: #2f6be5   Dark ground: #161826   Light ink: #e9e9ed
Type: Inter Medium (500)

Naming: "-dark-bg" = for use ON dark backgrounds (light artwork).
        "-light-bg" = for use ON light backgrounds (dark artwork).
All PNGs have transparent backgrounds except app-icons/.

svg/            Vector masters. mark = icon only (2a), lockup = Wash · icon · Level (3b).
                favicon.svg is the light-background mark.
                Lockup SVGs use live Inter text; convert to outlines before sending to a printer.
png-mark/       Icon alone, 16-1024px, transparent.
png-lockup/     Horizontal lockup by height, 24-512px, transparent.
app-icons/      Square icons with a solid ground and 8% padding, 16-1024px.
                iOS: 120/152/167/180/1024. Android: 48/72/96/192/512. Favicon: 16/32/48.
                Do not round the corners yourself - iOS and Android mask them.

Clear space: keep at least the vial's height clear on all sides.
Minimum sizes: icon 16px on screen, lockup 24px tall. Below that use the icon alone.
Do not recolor the bubble, stretch the vial, or add effects.
