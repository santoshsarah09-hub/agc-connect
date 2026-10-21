# AGC Connect

One web app for Awakening Generations Church. Works in any phone browser (iPhone and Android). iPhone: Share > Add to Home Screen. Android: menu > Install app.

## Sections and inside tabs
- **Home:** Today (a bright slideshow that fades through the welcome, Mission, Vision and 4E, then four quick buttons and the Verse of the Day in English and Nepali), Mission & Vision, 4E with scriptures
- **Getting around:** the logo / "AGC Connect" in the middle of the top bar always returns to Home. A "← Home" button appears on every other screen. The slideshow pauses on tap, can be moved with the dots or arrow keys, and stays still for people who have reduced motion turned on.
- **Prayer:** the full AGC Prayer Chain app (Pick a Time, Pray Together, Requests, My Hours, Translate, Admin). It runs inside this app and keeps its data in your Google Drive (see `prayer/SETUP.md`).
- **Kids Shine:** Memory Verse (6 steps), Games (7), Lesson, Assignments, Chat, Announcements, My Kids (with this week's progress), Teacher
- **Youth Shine:** Memory Verse (same 6 steps), Teaching, Assignments, Notes, Chat, Announcements, My Profile, Teacher
- **Worship:** Songs (search the church list or YouTube), Announcements, Calendar (add to phone calendar), Fellowship (a place to encourage each other)
- **Bible:** Read, Find a Verse, My Notes (all open in YouVersion)
- **AGC Leaders:** Post (announcements, events, songs), Resources (Drive folder and links), Leader Board (private), Team (admin adds leaders, picks their areas Kids / Youth / Worship, and gives each a personal PIN), Families (admin only: parent email and phone for each registered child; copy emails, download CSV). Leaders see only their areas; only the admin adds resources. Needs the Hub (see `hub/SETUP.md`).

## English and Nepali
The button at the top right switches the whole app between English and नेपाली, and remembers the choice on that phone (a phone set to Nepali starts in Nepali). Tap it again any time to go back. Button and label words are translated from `data/i18n.json`; add or fix any line there. Mission, Vision, 4E, assignments and verses show in Nepali only where you have supplied Nepali (`ne` fields, `title_ne`, `detail_ne`); otherwise they show in English. Nothing is machine-translated at run time. The labels in `i18n.json` were drafted by Claude and should be checked by a Nepali speaker. The Prayer Chain app was already side by side English and Nepali.

## Assignments, weekly progress and the Teacher tab
- **Teacher posts an assignment:** in the Teacher tab, type a title, details and due date, then copy the text it makes into `data/shine.json` under `kids` or `youth` > `assignments` (or send it to Claude). Children and youth see it in Assignments and tap Mark done.
- **Parents see progress:** My Kids shows this week (Sunday to Saturday): stars, verses learned, memory steps, game rounds, assignments done.
- **Teacher sees the week:** a parent taps Send report to teacher (it shares or copies a short message). The teacher pastes the messages into Teacher > Add reports and sees a table for the week. Reports stay on the teacher's phone. Nothing is sent automatically.

## What the Google scripts do (Apps Script)
Apps Script is the free "back room" that lets phones share information and keeps it in **your Drive**. The app works without it, but only for things that stay on one phone. There are two small scripts:
- **Prayer Chain script** (`prayer/backend/Code.gs`): the prayer hours, group prayer times and requests. Already running.
- **Hub script** (`hub/Code.gs`): Worship (announcements, songs, events, Fellowship) and AGC Leaders (leader PINs, resources, Leader Board). Setup: `hub/SETUP.md`.
Without the Hub, Worship shows only what is in `data/worship.json`, and Leaders and Fellowship say they are not connected yet.

## Where data lives
- **Prayer Chain:** your Google Drive (Executive Assistant Workspace / AGC Prayer Chain), through your own Apps Script. Free.
- **Worship and Leaders (once the Hub is set up):** your Google Drive (Executive Assistant Workspace / AGC Connect): a data sheet plus the Leader Resources folder.
- **Everything else (profiles, stars, assignments done, notes, chat, teacher reports):** on each person's own phone. It is not in your Drive and not on any server. If someone clears browser data or changes phones, that phone's progress is gone. Pastor-edited content (`data/*.json`) lives in the GitHub repo.

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
Everything opens in **YouVersion** (bible.com). Defaults: **NASB 1995** (English) and **NNRV** (Nepali). People can pick others: ESV, NIV, NKJV, NLT, KJV, and the Nepali NERV and NCV. Version IDs were checked on bible.com. Only the public-domain World English Bible is shown inside the app (for games and practice). To practice memory verses in NASB or NNRV, paste the verse text into `verseText` in `data/shine.json` (only text you are permitted to use).

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
Profiles and stars, notes, and chat are saved on each person's own phone, so people cannot see each other's messages. (The Prayer Chain is shared; it uses your Drive.) Sharing needs an online database with logins (Firebase or Supabase). The chat's safety rules cannot be enforced across phones until then, so do not open chat to children before that is in place.

## Child safety
First names only. No kid-to-kid private messages. Review US children's privacy rules (COPPA) before collecting any child data online. [Needs manual verification]

## Fun Zone (Kids Shine and Youth Shine)
Stars earned from memory verses and games stay with the child all month and start again from zero on the 1st. Kids spend 50 stars, Youth spend 40, to unlock 30 minutes of Car Race, Sliding Puzzle and Memory Match (Youth versions are harder: more lanes and speed, a 4x4 puzzle, 20 cards). A countdown shows the time left and the games lock when it ends. Change the cost or minutes in data/config.json: `"fun": {"kids": {"cost": 50, "minutes": 30}, "youth": {"cost": 40}}`.

## Assignments
With the Hub connected, teachers post assignments in Kids/Youth > Teacher. No file editing.

## Automatic progress and weekly verse/lesson (needs the Hub)
- **Parents opt in** per child in My Kids / My Profile ("Share progress with the teacher automatically"). A consent box explains what is shared: first name, and this week's stars, verses learned, steps, game rounds and assignments done. Turning it off (or removing the profile) deletes the shared copy.
- The phone sends an update a few seconds after progress changes. Data goes to the **Progress** tab of the Hub sheet in your Drive. Only leaders of that group (and the admin) can read it, in Kids/Youth > Teacher. The pasted-report method still works.
- **Teachers post the weekly verse and lesson** in Teacher > "This week's verse and lesson". Data goes to the **Weekly** tab and replaces the defaults from data/shine.json on every phone.
- Limits: 120 updates per phone per hour, 1500 per hour overall.

## Family registration

On Kids and Youth > Me, a parent can register a child: the child's first name (from the profile), last initial, parent email and phone, with a consent box. It is stored in the Hub sheet tab **Families** and shown only to the admin (Leaders > Families). Teachers cannot see it, and it never appears in the public feed. A parent can remove it any time; the admin can remove any row. Limits: 10 registrations per phone per hour. Contacts stay until removed (they are not part of the monthly cleanup). Backup copies of the sheet also contain them, so keep the AGC Connect Drive folder private.

## Alert emails

- **Hub:** when a *leader* (not the admin) posts an announcement, assignment, weekly verse/lesson, song or event, the owner gets an email with who, where and the title only. At most 15 per 6 hours. Turn off with `ALERTS: false` at the top of `hub/Code.gs`.
- **Prayer:** when someone sends a prayer request, the owner gets an email that one is waiting (never the request text). At most one per hour and 10 per day. Needs the new `prayer/backend/Code.gs` deployed.

## Weekly group prayer (Pray Together)

In the Prayer section > gear (Admin) > **Weekly group prayer**: tick *Repeat every week*, pick the day, time and length, give it a title (defaults: Friday 12:00 for 60 minutes, "Weekly Fasting Prayer"), and Save. The Prayer script then creates that group time on every matching date for this month and next, and again on the 1st of each new month (or the next time the admin opens that screen). A single date can still be edited or deleted; it is not brought back. Each group time also has an optional box, **off by default**, that adds a "Pray with this month's requests" button to that session; the monthly requests are never copied into the weekly prayer.

## Home: this Sunday's Scripture (from your preaching calendar)

The Home card shows the title and Scripture for the coming Sunday (today, if it is Sunday). The Hub script reads your Google Doc named like "2026 Preaching Calendar" (any doc with "Preaching Cal" and the year in its name; it picks the newest) and treats Week 1-4 as the 1st to 4th Sunday of each month. If you edit the calendar in Drive, the app follows within about 6 hours. A 5th Sunday has no entry, so Home shows the usual Verse of the Day. If the Hub cannot read the doc, the app falls back to `data/preaching.json` (a copy of the 2026 calendar). Run `checkPreachingCalendar` once in the Hub editor to approve the permission and see what it found.
