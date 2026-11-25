# Surface brief: gym admin dashboard (web/index.html), mode: Operate

Scope: staff admin app, phone and desk equally. Members app, receipt and desk-QR pages inherit the same tokens.
Audience/job: owner and trainers at the front desk and on the floor: see money and attendance at a glance, then verify a
bKash/Nagad TrxID, check someone in, send a WhatsApp reminder, in one tap each.
Constraints: static HTML/CSS/ES modules, no build, cheap Android on mobile data, English, AA contrast.
Unresolved: logo and brand colours (none yet; "Our Gym" is a placeholder in gym_settings).

## Direction contract

THESIS: A dashboard that is the shop's painted tin sign, not a SaaS panel: money owed is vermilion, everything settled is
quiet green, and every count sits on a painted enamel plate. Refuses the grey-sidebar, white-KPI-card admin.
OWN-WORLD: Rickshaw Enamel. Deep green #0F5132 shell, cream #F6F1E7 ground, vermilion #D7261E for owed money only,
ochre #F2B705 for focus and the active mark, ink #1B1B1B. Plates: 2px ink border with a 1px inset keyline, tabular
numerals. No flowers, peacocks or ornament; the world lives in palette, plates and type.
STORY: Open the app: today's numbers, then who came in without paying (vermilion), then TrxIDs to verify, then reminders.
The owner knows the day in one glance and acts without leaving the screen.
FIRST VIEWPORT: Phone: green top bar (gym name, date), quick check-in search, four plates (Active, In today, Revenue
plate double width with today and this month, Pending), then "Came in without paying" with WhatsApp buttons. Desktop: green
left rail with five nav items, plates in one row, action lists left, reminder lists right.
FORM: assigned direction Rickshaw Enamel, list position 7 of 7, seed:d5bed39a9ea0eee7 (re-roll 1).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
