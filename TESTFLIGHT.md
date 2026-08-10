# TestFlight, from where you are today to testers on their phones

This guide is written for **Adam** and for **the next Claude session**. Read it top to
bottom. Do the steps in order.

- Steps for **YOU** are in `> **Do this:**` boxes — one thing at a time.
- Steps for **Claude** are in `> **Claude does:**` boxes — copy the whole box into a
  new chat when asked.

The order matters because Apple's checks lock into place at each step. Skip a step
and the error message won't say what's missing.

**Where you are today.** The app is on your iPhone via Xcode and works. You have
joined the Apple Developer Program. The two health guides are approved (the injury
one after the PRICE rewrite is pending a physio read, and it needs one before you
send it to strangers).

**Where you'll be at the end.** Up to 100 people you know will have Inte-Run on
their phone from the TestFlight app, updates will arrive automatically, and their
paired Apple Watch will show today's session.

---

## 0 — One decision to make now

TestFlight has two tester groups:

- **Internal** — up to **100 people**, no Apple review, no privacy policy needed,
  builds land within minutes. **Start here.**
- **External** — up to 10,000 people, needs a first-time Apple review (a couple of
  days) and a privacy-policy URL. Do this later once internal testing is settled.

> **Do this:** decide who the first 5–10 internal testers are. They must have an
> Apple ID and a working email address. **Family and close friends first.** Text
> them: *"I'm testing my running app — you'll get an email from Apple with a link,
> tap it on your phone and follow the instructions. Takes 5 minutes."*

---

## 1 — Set up the app in App Store Connect (10 min)

This is Apple's website where the app record lives. It has to exist before you can
upload a build.

> **Do this:** open [App Store Connect](https://appstoreconnect.apple.com/) and
> sign in with the Apple ID that joined the Developer Program.

> **Do this:** click **My Apps** → **+** (top left) → **New App**.
> Fill in:
> - **Platforms:** tick **iOS**.
> - **Name:** `Inte-Run` (this is the App Store name; you can change it later).
> - **Primary language:** English (UK).
> - **Bundle ID:** choose **`com.interun.app`** from the dropdown. If it's not
>   there, click the little link that says *"Register a new Bundle ID"* and use
>   exactly `com.interun.app`.
> - **SKU:** `interun-ios` (a code only you see, any short text is fine).
> - **User access:** Full Access.
>
> Click **Create.**

> **Do this:** you'll land on the app's page. **Leave everything blank** — you do
> not need to fill in App Store screenshots or descriptions for internal testing.
> The only thing that matters right now is that the app record exists.

**Check:** you can see `Inte-Run` in your My Apps list. Bundle ID reads
`com.interun.app`.

---

## 2 — Do the first upload (Claude does it)

This is the fiddly step where Xcode talks to Apple. Claude handles it.

> **Do this:** open Claude on your Mac and paste the box below into a new chat.

> **Claude does:**
>
> ```
> Please build Inte-Run for TestFlight and upload it to App Store Connect.
> I'm following TESTFLIGHT.md step 2. Do all of this and stop after step (g):
>
> (a) `cd /Users/adampalmer/Developer/InteRun`
> (b) Confirm the working tree is clean with `git status`. If it isn't, stop
>     and ask me before doing anything else.
> (c) Regenerate the Xcode project: `python3 ios/make-project.py`.
>     This picks up the latest commit count as the build number and applies
>     it to all four targets (phone, watch, watch extension, widget).
> (d) Build the app FOR ARCHIVE (not for my phone):
>     ```
>     node web/app.ts
>     git checkout -- docs/voices/
>     xcodebuild -project ios/InteRun.xcodeproj -scheme InteRun \
>       -configuration Release -destination 'generic/platform=iOS' \
>       -allowProvisioningUpdates \
>       -archivePath /tmp/InteRun.xcarchive archive
>     ```
> (e) Export the .ipa:
>     ```
>     xcodebuild -exportArchive -archivePath /tmp/InteRun.xcarchive \
>       -exportOptionsPlist ios/ExportOptions.plist \
>       -exportPath /tmp/InteRun-ipa \
>       -allowProvisioningUpdates
>     ```
> (f) Open Transporter (Applications → Transporter). If it isn't installed,
>     tell me and I'll get it from the Mac App Store. Drag
>     /tmp/InteRun-ipa/InteRun.ipa into Transporter, sign in with my Apple ID
>     and click **Deliver**. Wait for the green tick.
> (g) Tell me the exact build number that went up (it's in the terminal output
>     from step c, and it's what I'll see in App Store Connect).
>
> ⚠️ Rules you MUST follow (from CLAUDE.md):
> - Never skip step (d)'s `git checkout -- docs/voices/` — the build silently
>   overwrites the committed audio and it must be restored.
> - If any step fails, stop and tell me the exact error. Do not try to guess
>   your way past it — the error message on the FIRST failure names the real
>   problem; every message after that is misleading.
> - Never bump the build number by hand; make-project.py sets it from the
>   commit count.
> ```

**Check:** Transporter shows a green tick and says *"Delivery successful."* You
see the build number in your terminal (something like `350`).

**What if it fails?** Almost always one of three things, and Claude will name which:

- **"Missing profile"** — Xcode couldn't get a distribution profile. Claude will
  try adding the flag again; if it can't, you may need to sign in to Xcode →
  Settings → Accounts once, then retry.
- **"Bundle ID not registered"** — you skipped step 1. Go back and do it.
- **"Invalid encryption info"** — this is already handled in the project, but if
  it appears, tell Claude and it will fix it.

---

## 3 — Wait for Apple's automatic scan (30–60 min)

Apple scans every upload before it can be tested. This is not the review — it's
automated malware/format checks.

> **Do this:** in App Store Connect, click **Inte-Run** → **TestFlight** (top
> tab). You'll see your build listed with a yellow **"Processing"** dot. Go and
> make a cup of tea. It usually takes 30 minutes.

> **Do this:** when the dot goes green, Apple emails you asking about **export
> compliance**. The question is *"does your app use encryption?"* The honest
> answer is **No** (Inte-Run uses only standard HTTPS, which Apple exempts). Tick
> the box that says "None of the algorithms mentioned above", or answer the
> equivalent question on the build's page in App Store Connect.

**Check:** the build in TestFlight shows a green dot and *"Ready to Test"* rather
than *"Missing Compliance"*.

---

## 4 — Add yourself as an internal tester (5 min)

You are your own first tester. This proves the whole pipeline works before you
invite anyone else.

> **Do this:** App Store Connect → **Users and Access** (top of the page) →
> confirm your name has the role **Admin** or **App Manager**. If it does, you're
> a valid internal tester by default.

> **Do this:** open **Inte-Run** → **TestFlight** → **Internal Testing** →
> **Create New Group** → name it `Owner + close friends`. Tick **"Enable
> automatic distribution"** (means new builds go to them automatically). Click
> **Create**.

> **Do this:** on that group's page, click **Add Testers** → tick your own name.
> Then in the **Builds** area of the same group, click **+** and add the build
> you just uploaded.

**Check:** the group shows 1 tester and 1 build.

> **Do this:** on your iPhone, install **TestFlight** from the App Store if you
> haven't already. Open the email from Apple ("You have been invited to test
> Inte-Run"), tap **View in TestFlight**, then **Install**.
>
> ⚠️ **Delete the Xcode-installed copy first** if you have one. Same bundle id,
> so your data survives, but two installs of the same app confuse iOS. Long
> press → Remove App → **Keep on My iPhone** first if you want a belt-and-braces
> backup of your data, otherwise Delete App.

**Check:** Support → Your data → **This version** shows the build number Claude
told you in step 2. Take a screenshot of that line.

**Try one thing:** start a short outdoor run, let it record for a minute, then
finish. If the map draws, the coach speaks, and the run appears in Logbook — the
whole pipeline works. If any of those fail, tell Claude and paste the "This
version" line and what happened.

---

## 5 — Invite your friends (5 min per person)

Only do this **after step 4 worked for you**. Never send testers something you
haven't run yourself.

> **Do this:** App Store Connect → Inte-Run → **Users and Access** → **+** →
> Invite each tester by email. Give them **App Manager** role and tick access to
> **Inte-Run** only.

> **Do this:** back in TestFlight → Internal Testing → your group → Add Testers
> → tick their names.

**Each tester will:**

1. Get an email from Apple.
2. Install TestFlight on their iPhone.
3. Open the invitation email on their phone → tap **View in TestFlight** →
   **Install**.
4. Open Inte-Run and follow the setup.

Send them a short message with what you're actually asking for. Something like:

> *"Please install and use it for a week. Any bugs, screenshots and a short
> description in a text to me. Doesn't matter how small — a wrong colour is
> useful. Don't share the app with anyone else yet, it's for a small group."*

**Check:** each tester texts you to say they're in. If they're stuck at any step,
they should send you the exact wording of the error.

---

## 6 — The Apple Watch bit

**Good news:** the watch app is inside the phone app. There is nothing separate to
install.

> **Tell your testers:** *"If you have an Apple Watch paired to your phone, open
> the Watch app on your iPhone, scroll down to Available Apps, find Inte-Run and
> tap Install. That's it — the watch will run today's session on its own."*

If a tester says the watch app is missing, the two things to check are: the phone
is paired to a Watch (Watch app opens without an error), and the Watch is on
watchOS 10 or newer.

---

## 7 — Shipping updates as you make them

When you ship a code change:

> **Do this:** open Claude on your Mac and paste this:

> **Claude does:**
>
> ```
> Please cut a new TestFlight build. Follow TESTFLIGHT.md step 2's build
> commands (c–f) again. Then tell me the new build number.
>
> The tester group has "Automatic Distribution" turned on, so I do NOT need
> to add the new build to the group by hand — everyone in it gets it as soon
> as Apple's processing goes green.
> ```

**Testers will:** get a notification from TestFlight saying "Update available",
tap it, done.

---

## Common problems, and what to do

**"My build isn't in App Store Connect."** Transporter didn't finish the upload,
or step 3's processing failed. Wait 15 more minutes. If still nothing, look for an
email from Apple that says why — those emails always name the real problem.

**"A tester says the invitation email never came."** Check the email address
you typed. If it's right, ask them to search their spam for `apple.com`. Apple
resends invitations on demand from the TestFlight page.

**"A tester says it says Inte-Run is expired."** Every TestFlight build expires
after **90 days**. Cut a new build (step 7).

**"I broke something and testers are complaining."** Roll back: in App Store
Connect, TestFlight, click the previous build, → **Expire** on the broken one so
nobody new gets it. Then cut a fix.

**"The coach isn't speaking / the map doesn't show."** These usually mean iOS
permissions weren't granted. Ask the tester to open the iPhone Settings app →
scroll to **Inte-Run** → make sure Location says "While Using" and Microphone /
Motion / Notifications are all on.

---

## What is NOT ready yet and what to do about it

**Internal-only for now.** Do not enable external testing until:

1. The injury guide's PRICE rewrite has been read by a physio (the PRE-PRICE
   wording was signed off; PRICE was not — see the Road Map hero for the honest
   status).
2. A privacy policy exists and is linked from the app. External review requires
   it. The simplest version: a page on your website that says what data the app
   collects (a name, a plan, runs stored on the phone) and that nothing leaves
   the device except when you tap Send-to-Strava.

**Strava.** Testers won't be able to connect Strava until you finish the
15-minute Worker setup in `alfie-proxy/README.md`. Everything else works without
it — hide the button in their versions by leaving `STRAVA_SERVER` empty if that
step isn't done. (Claude will tell you whether it's done when you ask for a
build.)

**The wellbeing questions and the eight limb warning signs.** Still open from
today's work — the definitions are in the engine but nothing on screen offers
them. Fine for internal testing; needs finishing before external.

---

## The one-page cheat sheet

```
FIRST TIME
  Step 1  App Store Connect → New App → com.interun.app                 (you)
  Step 2  Ask Claude to build, export and upload via Transporter        (Claude)
  Step 3  Wait for green dot, answer the encryption email               (you)
  Step 4  Add yourself as a tester, install via TestFlight, verify      (you)
  Step 5  Invite friends by email, add them to the group                (you)
  Step 6  Testers install the watch app via the Watch app on iPhone     (them)

EVERY UPDATE
  Step 7  Ask Claude to build again — auto-distribution does the rest   (Claude)
```

That's the whole thing. If any step feels wrong, don't push through — paste the
error into Claude and stop. **The message from the FIRST failure names the real
problem.** Everything Claude or Apple tells you after that is downstream noise.
