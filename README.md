# Evergleam

A cozy, hand-painted-looking Christmas tree. Pick your background, tree colour, lights and decorations, share your link, friends hang ornaments with sealed messages, and you open them on Christmas morning.

Plain static files, so it runs on GitHub Pages. Messages live in Firebase (free tier), which is also what keeps them locked: the rules in `firestore.rules` refuse to hand a message to anyone but the tree's owner, and not before the unlock time.

Until Firebase is connected the site runs in **preview mode** (everything saved in your own browser only). Add `&unlock` to a tree URL in preview mode to see what Christmas morning looks like.

## Setup (about 5 minutes)

1. **Create a Firebase project** at <https://console.firebase.google.com> (Analytics can be off).
2. **Add a web app**: Project settings → Your apps → Web (`</>`). Copy the `firebaseConfig` values into `firebase-config.js`. They are safe to commit.
3. **Turn on Google sign-in**: Authentication → Sign-in method → Google → Enable.
4. **Allow your site**: Authentication → Settings → Authorized domains → add `YOUR-USERNAME.github.io`.
5. **Create the database**: Firestore Database → Create database → production mode.
6. **Paste the rules**: Firestore → Rules → replace everything with the contents of `firestore.rules` → Publish.
7. **Turn on GitHub Pages**: repo Settings → Pages → Deploy from a branch → `main` / root.

Your site is then at `https://YOUR-USERNAME.github.io/REPO-NAME/`.

## Changing the unlock time

Edit `UNLOCK_AT` in `firebase-config.js` **and** the `unlocked()` line in `firestore.rules` (then publish the rules again). Right now both say midnight, Dec 25 2026, Vancouver time.

## How it works

- Each page of the tree holds 20 ornaments. Once a page fills, new ornaments start a fresh page, and arrows (or the ← → keys) flip between them.

- Only the tree owner signs in (Google). Friends just type a name and a message.
- `trees/{uid}`: the tree's name and its look (background, colours, decorations). `ornaments/`: who it's from and what it looks like (public). `messages/`: the text (owner only, after unlock).
- Anyone who visits can plant their own tree too.
