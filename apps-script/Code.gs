/** Backend for the SEO site. Free, runs on Google. See README step 1.
 *  Go to script.google.com > New project > paste this whole file > set SHEET_NAME below > run setup() once > Deploy as Web app.
 *  The Google Sheet is created for you automatically. No need to make one by hand. */
const SHEET_NAME = "SEO Agent Signups";   // <-- the name your new Google Sheet will get. Change it if you like.
const SHEET_ID = "";                      // optional: paste an existing Sheet ID to use that sheet instead. Leave empty to auto-create.
const DAILY_URLS = 300;   // page fetches each user may use per day (Google allows ~20,000 per day in total)
const TOKEN_DAYS = 14;
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" };

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function secret() { const p = PropertiesService.getScriptProperties(); let s = p.getProperty("SECRET"); if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty("SECRET", s); } return s; }
function sign(m) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(m, secret())); }
function makeToken(email) { const m = email + "|" + (Date.now() + TOKEN_DAYS * 864e5); return Utilities.base64EncodeWebSafe(m) + "." + sign(m); }
function verify(t) {
  try { const [a, sig] = String(t).split("."); const m = Utilities.newBlob(Utilities.base64DecodeWebSafe(a)).getDataAsString(); const [email, exp] = m.split("|");
    return sign(m) === sig && Number(exp) > Date.now() ? email : null; } catch (e) { return null; }
}
function hash(salt, pw) { let h = salt + pw; for (let i = 0; i < 100; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h)); return h; }
function getSS() {
  const p = PropertiesService.getScriptProperties(), id = SHEET_ID || p.getProperty("SS_ID");
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create(SHEET_NAME); p.setProperty("SS_ID", ss.getId()); return ss;
}
function setup() {   // run this once from the editor: it creates the Sheet and prints its link in the Execution log
  const ss = getSS(); sheet("Signups", ["Signed up (UTC)", "Full name", "Email", "Website"]); try { sheet("_accounts", ["email", "salt", "hash"]).hideSheet(); } catch (e) {}
  const d = ss.getSheetByName("Sheet1"); if (d && ss.getSheets().length > 1) ss.deleteSheet(d);
  Logger.log("Sheet ready: " + ss.getUrl());
}
function sheet(name, head) { const ss = getSS(); let s = ss.getSheetByName(name); if (!s) { s = ss.insertSheet(name); s.appendRow(head); } return s; }
function findRow(s, email) { const n = s.getLastRow(); if (n < 2) return null; return s.getRange(2, 1, n - 1, 3).getValues().find(r => r[0] === email) || null; }
const safe = v => /^[=+\-@]/.test(v) ? "'" + v : v;   // stops spreadsheet formula injection

function budget(email, n) {
  const p = PropertiesService.getScriptProperties(), k = "u:" + email + ":" + new Date().toISOString().slice(0, 10), used = Number(p.getProperty(k) || 0);
  if (used + n > DAILY_URLS) throw new Error("Daily limit reached. Please try again tomorrow.");
  p.setProperty(k, used + n);
}
function cleanup() {   // optional: add a daily time-driven trigger for this
  const p = PropertiesService.getScriptProperties(), today = new Date().toISOString().slice(0, 10);
  Object.keys(p.getProperties()).forEach(k => { if (k.indexOf("u:") === 0 && k.slice(-10) !== today) p.deleteProperty(k); });
}

function signup(d) {
  const name = String(d.name || "").trim().slice(0, 80), email = String(d.email || "").trim().toLowerCase().slice(0, 120),
    site = String(d.website || "").trim().slice(0, 200), pw = String(d.password || "");
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter your name and a valid email." };
  if (pw.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (!d.agree) return { ok: false, error: "Please accept the Privacy Policy." };
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const acc = sheet("_accounts", ["email", "salt", "hash"]);
    if (findRow(acc, email)) return { ok: false, error: "This email is already registered. Please log in." };
    const salt = Utilities.getUuid(); acc.appendRow([email, salt, hash(salt, pw)]); try { acc.hideSheet(); } catch (e) {}
    sheet("Signups", ["Signed up (UTC)", "Full name", "Email", "Website"])
      .appendRow([Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd HH:mm:ss"), name, email, site].map(safe));
    return { ok: true, token: makeToken(email), name };
  } finally { lock.releaseLock(); }
}
function login(d) {
  const email = String(d.email || "").trim().toLowerCase(), cache = CacheService.getScriptCache(), fk = "f:" + email, fails = Number(cache.get(fk) || 0);
  if (fails >= 8) return { ok: false, error: "Too many failed attempts. Try again in 15 minutes." };
  const row = findRow(sheet("_accounts", ["email", "salt", "hash"]), email);
  if (row && hash(row[1], String(d.password || "")) === row[2]) return { ok: true, token: makeToken(email), name: email };
  cache.put(fk, String(fails + 1), 900); return { ok: false, error: "Wrong email or password." };
}

function doFetch(d, email) {
  const urls = (d.urls || []).filter(u => /^https?:\/\//i.test(u)).slice(0, 12); budget(email, urls.length);
  const reqs = urls.map(u => ({ url: u, method: d.method === "head" ? "head" : "get", headers: UA, muteHttpExceptions: true, followRedirects: !d.noredirect }));
  const t = Date.now(); let res;
  try { res = UrlFetchApp.fetchAll(reqs); } catch (e) { res = reqs.map(r => { try { return UrlFetchApp.fetch(r.url, r); } catch (x) { return null; } }); }
  const ms = Date.now() - t;
  return { ok: true, results: res.map((r, i) => {
    if (!r) return { status: 0 };
    let st = r.getResponseCode();
    if (d.method === "head" && [403, 405, 501].indexOf(st) > -1) { try { st = UrlFetchApp.fetch(urls[i], { headers: UA, muteHttpExceptions: true }).getResponseCode(); } catch (e) {} }
    const hd = r.getHeaders(), ct = String(hd["Content-Type"] || hd["content-type"] || ""), o = { status: st, ms: ms, loc: hd["Location"] || hd["location"] || "" };
    if (d.method !== "head" && /html|xml|text/i.test(ct)) { const b = r.getContentText(); o.size = b.length; o.body = b.slice(0, 300000); }
    return o;
  }) };
}
function doSuggest(d, email) {
  const qs = (d.queries || []).slice(0, 45); budget(email, qs.length);
  const reqs = qs.map(q => ({ url: "https://suggestqueries.google.com/complete/search?client=firefox&q=" + encodeURIComponent(q), headers: UA, muteHttpExceptions: true }));
  let res; try { res = UrlFetchApp.fetchAll(reqs); } catch (e) { return { ok: true, lists: qs.map(() => []) }; }
  return { ok: true, lists: res.map(r => { try { return JSON.parse(r.getContentText())[1] || []; } catch (e) { return []; } }) };
}
function doSearch(d, email) {
  budget(email, 1);
  const r = UrlFetchApp.fetch("https://html.duckduckgo.com/html/", { method: "post", payload: { q: String(d.q || "").slice(0, 200) }, headers: UA, muteHttpExceptions: true });
  return { ok: true, html: r.getContentText().slice(0, 300000) };
}

function doGet() { return out({ ok: true, message: "SEO backend is running. Now paste this URL into setup.html." }); }

function doPost(e) {
  let d; try { d = JSON.parse(e.postData.contents); } catch (x) { return out({ ok: false, error: "Bad request" }); }
  try {
    if (d.action === "ping") return out({ ok: true });
    if (d.action === "signup") return out(signup(d));
    if (d.action === "login") return out(login(d));
    const email = verify(d.token); if (!email) return out({ ok: false, auth: true, error: "Please log in again." });
    if (d.action === "fetch") return out(doFetch(d, email));
    if (d.action === "suggest") return out(doSuggest(d, email));
    if (d.action === "search") return out(doSearch(d, email));
    return out({ ok: false, error: "Unknown action" });
  } catch (err) { return out({ ok: false, error: String(err.message || err) }); }
}
