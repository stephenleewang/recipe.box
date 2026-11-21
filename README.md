# Recipe Box

Your recipe app as an installable, offline web app. It comes with your 19 recipes already loaded.

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The whole app |
| `seed.json` | Your recipes, loaded the first time the app opens |
| `sw.js` | Lets the app open and work offline |
| `manifest.webmanifest`, `icons/` | App name and home screen icon |
| `netlify/functions/recipe.mjs` | Reads a recipe page when you import from a link |
| `netlify.toml` | Netlify settings |

## Deploy it

### Option 1: GitHub + Netlify (recommended, everything works)

1. Create a new GitHub repo and upload everything in this folder (keep the folder structure).
2. In Netlify: **Add new project → Import an existing project → GitHub**, pick the repo.
3. Leave the build settings empty (`netlify.toml` handles it) and deploy.

Every time you push a change, Netlify redeploys.

### Option 2: Netlify CLI (no GitHub)

```
npm install -g netlify-cli
cd recipe-box
netlify deploy --prod
```

Follow the prompts to create a new site.

### Option 3: Drag and drop

Log in at app.netlify.com, go to **Add new project → Deploy manually**, and drop this folder.
The app itself will work. Link import depends on the function deploying; if it doesn't, the
app tells you "Link import isn't set up on this deploy yet." Use Option 1 or 2 if that happens.

## Put it on your iPhone

1. Open your Netlify URL in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen icon. It runs full screen and works offline.

## Good to know

- **Your data lives on your phone**, inside the app. It doesn't sync between devices.
  Tap **Back up recipes** at the bottom of the home screen now and then and save the file
  to iCloud Drive. **Restore a backup** loads it on another device or after a reset.
- **Link import** works on most recipe sites (it reads the recipe data those sites publish
  for Google). Some sites block it. For those, use the **Copy recipe** bookmark:
  in the app tap **+ Add → Paste → Set up the bookmark** for the steps. Then on any recipe
  page in Safari, tap the bookmark and paste into the Paste tab. Pasting plain recipe text
  (with Ingredients and Instructions headings) works too.
- **Updating the app:** after editing `index.html`, change `VERSION` in `sw.js`
  (for example `recipe-box-v2`) so phones pick up the new version.
- `seed.json` is only read the first time. Editing it later won't overwrite recipes already on your phone.
