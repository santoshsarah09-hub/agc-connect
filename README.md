# AGC Connect

One web app for Awakening Generations Church: **Prayer Chain**, **Kids Shine**, **Youth Shine**, and **Bible**. Each has its own inside tabs. Works in any phone browser (iPhone and Android). iPhone: Share > Add to Home Screen. Android: menu > Install app.

## Inside tabs
- Prayer Chain: Sign Up, Schedule, Prayer Requests
- Kids Shine: Memory Verse, Lesson, Games, Announcements
- Youth Shine: Memory Verse, Teaching, Notes, Announcements
- Bible: Read, Find a Verse, My Notes

## Weekly updates (pastor edits these files)
- `data/shine.json`: weekly verse, lesson, announcements, game verses
- `data/prayer.json`: monthly prayer requests, English in `en`, Nepali in `ne`. Leave `ne` empty rather than guessing.
- `data/config.json`: Bible versions and the member password

## Member password
Leave `passwordSha256` empty for no password. To set one, make its SHA-256 and paste it in:

    printf 'YourPassword' | sha256sum

**Honest limit:** on a static site this password only keeps casual visitors out. Anyone who knows how to view page files can get around it, and the data files are readable. Do not put sensitive details (full names, phone numbers, medical or family details) in `data/`. For real privacy, the app needs a login backend.

## Bible versions
Defaults: **NASB 1995** (English) and **NNRV** (Nepali). People can switch versions in the app.
- NASB 1995 is licensed, so the text is not stored here. The app opens it in a new tab. [Needs manual verification: licensing for showing it inside the app]
- NNRV is not connected yet. A verified, licensed source is needed. [Needs manual verification] ERV-NE (Nepali) opens in a new tab as a stand-in.
- The public-domain World English Bible shows inside the app and powers the games.

## Preview mode (what is not shared yet)
Prayer sign-ups and notes are saved on each person's own phone, so two people cannot yet see each other's slots. A shared sign-up sheet needs an online database (Firebase or Supabase). Prayer requests and Shine content already work for everyone, because they come from the `data/` files.

## Not built yet
Homework with teacher grading, announcements push notifications, shared sign-ups.

## Child safety
No kid-to-kid chat, no public profiles, first names only. Review US children's privacy rules (COPPA) before collecting any child data online. [Needs manual verification]
