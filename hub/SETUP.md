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

## Leaders, PINs and who can see what
- Sign in at **AGC Leaders** with the name **Admin** and your admin PIN. **You (admin) can see and do everything.**
- **Team** tab > add each leader: first name, role, and tick the area(s) they get: **Kids**, **Youth**, **Worship**. The app shows their personal 6-digit PIN **once**. Give it to them privately. You can change their areas, issue a new PIN, or remove them any time; it takes effect at once, even if they are signed in.
- **Sunday school teachers (Kids):** the Kids Teacher tab (weekly progress), Kids announcements and events, and files in the **Kids** folder.
- **Youth leaders (Youth):** the same for Youth.
- **Worship leaders (Worship):** songs, Worship announcements and events, and files in the **Worship** folder.
- **Every leader:** the **All Leaders** folder, the Leader Board for all leaders, and reporting or removing Fellowship posts.
- **Only you:** announcements and events for Everyone, adding or removing resources, and managing the team.
- The script enforces this on the server, not only on the screen. 5 wrong PINs lock that sign-in for 15 minutes. A leader stays signed in up to about 6 hours. PINs are stored only as salted hashes.

## Adding resources (only you)
1. In Drive open **Executive Assistant Workspace > AGC Connect > Leader Resources**. `setup` made four folders there: **All Leaders**, **Kids**, **Youth**, **Worship**.
2. Put each document in the right folder (a document in the main folder, or in All Leaders, is seen by every leader; a folder with any other name is seen only by you). Sub-folders are fine.
3. Share the **Leader Resources** folder with each leader's Google account as **Viewer** (not Editor), so they cannot add, change or delete anything.
4. To stop downloading: open the file in Drive > Share > the gear (Settings) > untick **"Viewers and commenters can see the option to download, print, and copy"**. Do this for each file. [Needs manual verification: whether this setting can be applied to a whole folder]
5. Leaders open files from the app's Resources tab. They are viewed in Drive, so a leader must be signed in to the Google account you shared with.
6. You can also add web links in the app (Resources > Add a link) and pick which group sees them.

## Limits and honest notes
- Anyone with the app link can read the public parts (announcements, songs, events, Fellowship). Only first names appear. The Leaders pages need a PIN.
- A PIN is not bank-level security. Do not store sensitive personal information in Leaders.
- Resource files are protected by **Drive sharing**. The app only decides which file names a leader sees. Anyone who has a file's link and Drive access to it can open it, so share the folder only with leaders, as Viewer. Turning off download, print and copy stops the easy routes, but a screenshot or photo of the screen cannot be prevented.
- A free Google script handles roughly 30 requests at once. A burst right after an announcement may feel slow for a few seconds. Nothing is lost.
- The app refreshes the shared list at most every 20 seconds, so a new post appears on other phones within about 20 to 90 seconds.
- There are no push notifications. People see a red dot on Worship when something new is posted, and can add events and assignment due dates to their phone calendar (with an alert). Real push needs a separate always-on service. [Needs manual verification: free options]
- Data is stored in your Google Drive under your account. If you delete the sheet, the data is gone; use File > Version history or make a copy now and then.
