# SEO Agent: static website (HTML, CSS, JavaScript) + free Google backend

Front end = plain HTML/CSS/JS, hosted free on **GitHub Pages**.
Back end = one **Google Apps Script** (free) that saves signups to your Google Sheet and fetches pages for the SEO tools.
GitHub Pages cannot run server code, so the Apps Script is what makes signup, login and crawling possible.

## Step 1: Backend (the Google Sheet is created automatically)
1. Go to script.google.com > New project. Delete the sample code and paste all of `apps-script/Code.gs`.
2. At the top, change `SHEET_NAME` to the name you want for your Google Sheet (or leave it).
3. Choose the function **setup** in the toolbar and press Run. Allow the permissions. The Execution log prints the link to your new Sheet.
4. Deploy > New deployment > type **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy and copy the **Web app URL**.
Signups appear in the "Signups" tab (Date, Full name, Email, Website). Passwords are salted and hashed in a hidden "_accounts" tab. Do not share the Sheet with other people.
To use an existing Sheet instead, paste its ID into `SHEET_ID`. After any change to Code.gs: Deploy > Manage deployments > Edit > New version.

## Step 2: Connect (easy way)
Open `setup.html` (double-click it on your computer, or open it on your live site). Paste the Web app URL, press **Test connection**, then **Download config.js**.
Replace `config.js` in your GitHub repo with the downloaded file. You can also edit `config.js` by hand: put the URL in `API_URL`.
Replace `YOUR-USERNAME.github.io/YOUR-REPO` in `sitemap.xml` and `robots.txt` with your real address.
Until this step is done, the signup form shows "backend is not connected". That message is expected, not a bug.

## Step 3: GitHub Pages
1. Create a GitHub repo and upload ALL these files (index.html must be in the repo root).
2. Settings > Pages > Deploy from a branch > `main` / root. Your site appears at `https://USERNAME.github.io/REPO/`.
   (Free GitHub accounts need a public repo for Pages. Nothing in this repo is secret.)

## Step 4: AdSense (optional)
After AdSense approves your domain, put `ADSENSE_CLIENT` and `ADSENSE_SLOT` in `config.js` and your publisher id in `ads.txt`.
`ads.txt` must be served from your domain root, so use a custom domain (Settings > Pages > Custom domain).
Edit `privacy.html` to match your country's law. EU/UK visitors also need a cookie consent banner.

## Limits to know
- Each user gets 300 page fetches per day (`DAILY_URLS` in Code.gs). Google allows about 20,000 fetches per day for the whole script.
- Anyone can read the front-end code, but every tool call needs a valid login token checked by the backend.
- Rank checks use DuckDuckGo and keyword ideas use Google suggestions, both fetched from Google's servers. If they block it, results will be empty.
