# AGC Connect

One web app for Awakening Generations Church. Works in any phone browser (iPhone and Android). iPhone: Share > Add to Home Screen. Android: menu > Install app.

## Sections and inside tabs
- **Home:** Today (logo + Verse of the Day in English and Nepali), Mission & Vision, 4E with scriptures
- **Prayer:** Sign Up, Schedule, Prayer Requests
- **Kids Shine:** Memory Verse (6 steps), Games (7), Lesson, Chat, Announcements, My Kids
- **Youth Shine:** Memory Verse (same 6 steps), Teaching, Notes, Chat, Announcements, My Profile
- **Bible:** Read, Find a Verse, My Notes

## Memory verse steps (Kids and Youth)
1 Read it 3 times, 2 Listen, 3 Pieces (phrase by phrase), 4 Fill the blanks (easy, medium, hard), 5 First letters, 6 Recite. Finishing all six marks the verse learned (+5 stars).

## Kids games
Word Order, Which Verse Is It, Missing Word, Who Am I, Books in Order, Old or New Testament, Memory Match.

## Weekly updates (pastor edits these files in the repo)
- `data/shine.json`: weekly verse, lesson, announcements, game verses, optional `verseText`
- `data/prayer.json`: monthly prayer requests, English in `en`, Nepali in `ne`
- `data/home.json`: Mission, Vision, 4E. The Nepali (`ne`) fields are empty on purpose; add your own.
- `data/games.json`: "Who Am I" questions
- `data/votd.json`: church list of daily verses (used until a YouVersion key is added)
- `data/config.json`: Bible versions, member password, leader PIN, chat rules, YouVersion key

## Bible versions
Defaults: NASB 1995 (English) and NNRV (Nepali). People can switch.
- NASB 1995 is licensed, so the text is not stored here; it opens in a new tab. [Needs manual verification: licensing to show it inside the app]
- NNRV is not connected yet; it needs a verified, licensed source. [Needs manual verification] ERV-NE opens as a stand-in.
- The public-domain World English Bible shows inside the app and powers the games.
- To practice memory verses in NASB or NNRV, paste the verse text into `verseText` in `data/shine.json` (only text you are permitted to use). Otherwise practice uses the World English Bible.

## Verse of the Day (YouVersion)
YouVersion has a Verse of the Day service. It needs a free app key from platform.youversion.com. Paste it in `config.json` under `youversion.appKey`. Until then the app uses `data/votd.json`. [Needs manual verification: whether a key may be used in public browser code, and which Nepali versions your key can show.] Anything placed in a public repo can be read by anyone.

## Member password and leader PIN
Leave `passwordSha256` empty for no password. To set one: `printf 'YourPassword' | sha256sum` and paste the result. Same for `leaderPinSha256` (leaders can post in Kids chat, pin and delete messages).
**Honest limit:** on a static site these only keep casual visitors out. Do not put sensitive details in `data/`.

## Parent sign-in (Firebase, free tier)
When Firebase is connected, the app asks parents to sign in or create an account (email + password) before anything opens. Children do **not** get logins: a parent adds each child as a profile under their account (first name and age group only). Youth can use a parent's account, or their own if they are 13 or older. Profiles, stars, progress and notes are saved to the account and follow the family to any phone. Signing out clears the family's data from that phone. If Firebase is configured but cannot be reached, the app stays locked (it never fails open). Until Firebase is connected, the app runs in preview mode with no sign-in.

**Set up (about 15 minutes):**
1. Go to console.firebase.google.com and create a project (Google Analytics can be off).
2. Authentication > Sign-in method > turn on **Email/Password**.
3. Authentication > Settings > Authorized domains > add `santoshsarah09-hub.github.io` (and your own domain if you use one).
4. Firestore Database > Create database (production mode).
5. Firestore Database > Rules > paste the contents of `firestore.rules` from this repo and Publish. This is what keeps each family's data private.
6. Project settings > Your apps > add a **Web app**. Copy the config values (`apiKey`, `authDomain`, `projectId`, `appId`) into `firebase` in `data/config.json`.
The Firebase web config is meant to be public; the rules, not the config, protect the data. [Needs manual verification against current Firebase docs]

**Still to decide:** email verification, a parent PIN before children can switch profiles or sign out, and review of US children's privacy rules (COPPA) before launch. [Needs manual verification] Sign-in covers profiles and notes only. Prayer sign-ups and chat are still on each phone until their shared collections and rules are added.

## Chat
Kids chat is leaders-post, kids-react by default (`chat.kids` in config; set `"open"` to let kids post). Youth chat is open. Rules built in: no links (removed), 280-character limit, no private messages, report button (reported messages are hidden from members until a leader reviews), leaders can pin and delete.

## Preview mode (what is not shared yet)
Prayer sign-ups, profiles and stars, notes, and chat are saved on each person's own phone, so people cannot yet see each other's slots or messages. Sharing needs an online database with logins (Firebase or Supabase). The chat's safety rules cannot be enforced across phones until then, so do not open chat to children before that is in place.

## Child safety
First names only. No kid-to-kid private messages. Review US children's privacy rules (COPPA) before collecting any child data online. [Needs manual verification]
