const C = window.CFG, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sess = () => { try { const s = JSON.parse(localStorage.getItem("seo_sess") || "null"); return s && s.exp > Date.now() ? s : null } catch (e) { return null } };
async function api(action, data = {}) {
  if (!C.API_URL || C.API_URL.startsWith("PASTE")) throw new Error("This site is not fully set up yet (the backend is not connected). Site owner: open setup.html and follow the steps.");
  const s = sess();
  let j;
  try { j = await (await fetch(C.API_URL, { method: "POST", body: JSON.stringify({ action, token: s && s.token, ...data }) })).json() }
  catch (e) { throw new Error("Could not reach the server. Check your internet connection and the API_URL in config.js.") }
  if (!j.ok) { if (j.auth) { localStorage.removeItem("seo_sess"); location = "login.html" } throw new Error(j.error || "Request failed") }
  return j;
}
function authForm(f, kind) {
  f.onsubmit = async e => {
    e.preventDefault(); const b = $("button", f), m = $(".err", f); m.textContent = ""; b.disabled = true;
    try {
      const d = Object.fromEntries(new FormData(f)), j = await api(kind, d);
      localStorage.setItem("seo_sess", JSON.stringify({ token: j.token, name: j.name, email: d.email.trim().toLowerCase(), exp: Date.now() + 13 * 864e5 }));
      location = "app.html";
    } catch (x) { m.textContent = x.message }
    b.disabled = false;
  };
}
$$("[data-name]").forEach(n => n.textContent = C.NAME);
$$("[data-contact]").forEach(n => { n.textContent = C.CONTACT; if (n.tagName === "A") n.href = "mailto:" + C.CONTACT });
$("#nav").innerHTML = `<nav class="nav"><a class="logo" href="index.html">${esc(C.NAME)}</a><a href="tools.html">Tools</a><a href="guides.html">Guides</a><a href="about.html">About</a><a href="contact.html">Contact</a><span class="sp"></span>${sess() ? '<a href="app.html">Workspace</a><a href="#" id="lo">Log out</a>' : '<a href="login.html">Log in</a><a class="cta" href="signup.html">Sign up</a>'}</nav>`;
$("#foot").innerHTML = `<footer><b>${esc(C.NAME)}</b> &middot; <a href="tools.html">Tools</a> &middot; <a href="guides.html">Guides</a> &middot; <a href="about.html">About</a> &middot; <a href="contact.html">Contact</a> &middot; <a href="privacy.html">Privacy</a> &middot; <a href="terms.html">Terms</a><br>&copy; ${new Date().getFullYear()} ${esc(C.NAME)}. SEO results depend on many factors and are never guaranteed.</footer>`;
const lo = $("#lo"); if (lo) lo.onclick = e => { e.preventDefault(); localStorage.removeItem("seo_sess"); location = "index.html" };
const af = $("#f"); if (af) authForm(af, af.dataset.kind);
if (/^ca-pub-\d+$/.test(C.ADSENSE_CLIENT)) {
  const s = document.createElement("script"); s.async = true; s.crossOrigin = "anonymous";
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + C.ADSENSE_CLIENT; document.head.appendChild(s);
  if (/^\d+$/.test(C.ADSENSE_SLOT)) $$(".ad").forEach(a => {
    a.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${C.ADSENSE_CLIENT}" data-ad-slot="${C.ADSENSE_SLOT}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  });
}
