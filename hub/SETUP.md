# AGC Connect Hub: setup (about 15 minutes, one time)

The Hub is a small free Google Apps Script that runs as **you**, so Worship and Leaders data lives in **your** Google Drive. It is separate from the Prayer Chain script, which keeps working as it is.

## What it stores (all in Drive)
`My Drive / Executive Assistant Workspace / AGC Connect /`
- **AGC Connect - Hub Data** (a Google Sheet): Leaders, Announcements, Songs, Events, Fellowship, LeaderBoard, Resources
- **Leader Resources /** (a folder): drop documents here and leaders see them in the app

## Steps
1. Go to **script.google.com** (signed in as the Google account that owns your Drive) > **New project**. Name it "AGC Connect Hub".
2. Delete the sample code. Paste all of `hub/Code.gs`. **Save**.
3. In the function dropdown pick **setup** > **Run**. Allow access (you will see an "unverified app" warning because it is your own script: **Advanced > Go to project > Allow**).
4. Open **Execution log**. It prints **your admin PIN**. Write it down. (Change it later in Project Settings > Script properties > `ADMIN_PIN`.)
5. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy and copy the **Web app URL**.
6. Put that URL in `data/config.json` as `"hubUrl"` (or send it to Claude to do it). Commit. The app picks it up in a minute or two.
7. In Drive, **share the "Leader Resources" folder** with each leader's Google account (Viewer or Editor). The app lists the files, but only people you shared the folder with can open them.

**Updating Code.gs later:** paste, Save, then **Deploy > Manage deployments > Edit > New version > Deploy**. Phones keep using the old code until you do.

## Leaders and PINs
- Sign in at **AGC Leaders** with the name **Admin** and your admin PIN.
- **Team** tab > add each leader (first name and role). The app shows their personal 6-digit PIN **once**. Give it to them privately.
- Each leader signs in with their own name and PIN. You can issue a new PIN or remove a leader any time; removal works at once, even if they are signed in.
- 5 wrong PINs lock that sign-in for 15 minutes. A leader stays signed in up to about 6 hours.
- PINs are stored only as salted hashes, never as the PIN itself.

## What leaders can do
- Post announcements (Everyone, Worship tab only, or Leaders only), events (people can add them to their calendar), and songs (a name plus a link to the words or chords; do not paste copyrighted lyrics).
- Review Fellowship posts people reported, put them back or delete them. Leaders can also remove any Fellowship post.
- Share resources: files in the Drive folder, plus links.
- Use the Leader Board, a private message board for signed-in leaders.

## Limits and honest notes
- Anyone with the app link can read the public parts (announcements, songs, events, Fellowship). Only first names appear. The Leaders pages need a PIN.
- A PIN is not bank-level security. Do not store sensitive personal information in Leaders.
- Resource files are protected by **Drive sharing**, not by the PIN. Anyone who is given a file's link and has Drive access to it can open it. Keep the folder shared only with leaders.
- A free Google script handles roughly 30 requests at once. A burst right after an announcement may feel slow for a few seconds. Nothing is lost.
- The app refreshes the shared list at most every 20 seconds, so a new post appears on other phones within about 20 to 90 seconds.
- There are no push notifications. People see a red dot on Worship when something new is posted, and can add events and assignment due dates to their phone calendar (with an alert). Real push needs a separate always-on service. [Needs manual verification: free options]
- Data is stored in your Google Drive under your account. If you delete the sheet, the data is gone; use File > Version history or make a copy now and then.
