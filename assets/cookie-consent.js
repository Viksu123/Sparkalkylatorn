/*
  Cookie-samtycke och Google Analytics för Räntakalkylatorn.

  Så fungerar det:
  - Google Analytics laddas ALDRIG innan besökaren har klickat på "Godkänn".
  - Klickar besökaren på "Neka", eller inte svarar alls, laddas ingen spårning
    och inga cookies sätts.
  - "Neka" och "Godkänn" är lika stora och lika tydliga.
  - Valet sparas i webbläsarens localStorage (ingen cookie) i 12 månader.
  - Knappen "Cookieinställningar" i sidfoten (attributet data-cookie-settings)
    öppnar rutan igen, så besökaren kan ändra sig när som helst.
  - Ändrar besökaren från "Godkänn" till "Neka" tas Googles cookies bort och
    sidan laddas om, så att spårningen stängs av direkt.
*/
(function () {
  "use strict";

  /* ==================================================================
     STEG 1: KLISTRA IN DITT MÄT-ID HÄR (mellan citattecknen).

     Du hittar det i Google Analytics under Administratör, Dataströmmar,
     din webbström. Det börjar med G- och ser ut ungefär så här:
     G-AB12CD34EF

     Så länge det står G-XXXXXXXXXX gör skriptet ingenting: ingen
     cookie-ruta visas och ingen spårning laddas.
     ================================================================== */
  var GA_MEASUREMENT_ID = "G-WH7YVHP486
";

  var STORAGE_KEY = "rk-cookie-consent";
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

  var ID_OK = /^G-[A-Z0-9]{6,14}$/.test(GA_MEASUREMENT_ID) && !/^G-X+$/.test(GA_MEASUREMENT_ID);

  /* ---------- Lagring av valet ---------- */
  function readChoice() {
    try {
      var v = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (v && (v.choice === "accepted" || v.choice === "rejected") && Date.now() - v.time < MAX_AGE_MS) {
        return v.choice;
      }
    } catch (e) {}
    return null;
  }

  function saveChoice(choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice: choice, time: Date.now() }));
    } catch (e) {}
  }

  /* ---------- Google Analytics (laddas först efter "Godkänn") ---------- */
  var analyticsLoaded = false;

  function loadAnalytics() {
    if (analyticsLoaded) return;
    analyticsLoaded = true;
    window["ga-disable-" + GA_MEASUREMENT_ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_MEASUREMENT_ID);
    document.head.appendChild(s);
  }

  function clearAnalyticsCookies() {
    var host = window.location.hostname;
    var parts = host.split(".");
    var domains = [host, "." + host];
    for (var i = 1; i < parts.length - 1; i++) domains.push("." + parts.slice(i).join("."));
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].replace(/^\s+|\s+$/g, "");
      if (name !== "_ga" && name.indexOf("_ga_") !== 0) return;
      var expired = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      document.cookie = expired;
      domains.forEach(function (d) { document.cookie = expired + "; domain=" + d; });
    });
  }

  /* ---------- Utseende (CSS) ---------- */
  var CSS =
    ".cc-banner{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:1000;" +
    "max-width:46rem;margin:0 auto;background:var(--surface,#fff);color:var(--ink,#12262b);" +
    "border:1px solid var(--line,#d3dcd9);border-radius:12px;box-shadow:0 10px 32px rgba(0,0,0,.16);" +
    "padding:14px 18px;font:inherit;font-size:.92rem;line-height:1.5;animation:cc-in .25s ease-out}" +
    ".cc-banner[hidden]{display:none}" +
    ".cc-banner .cc-title{font-family:var(--serif,Georgia,serif);font-size:1.05rem;font-weight:700;margin:0 0 4px}" +
    ".cc-banner p{margin:0 0 6px;color:var(--muted,#53666b)}" +
    ".cc-banner a{color:var(--accent,#0a7358)}" +
    ".cc-banner .cc-status{font-weight:600;color:var(--ink,#12262b)}" +
    ".cc-actions{display:flex;gap:10px;margin-top:10px}" +
    ".cc-actions button{flex:1 1 0;min-height:44px;font:inherit;font-weight:700;padding:9px 16px;border-radius:8px;" +
    "cursor:pointer;border:2px solid var(--accent,#0a7358);background:var(--accent,#0a7358);color:var(--accent-ink,#fff)}" +
    ".cc-actions button:hover{filter:brightness(1.08)}" +
    ".cc-actions button:focus-visible,.cc-banner a:focus-visible,.cc-link:focus-visible{outline:3px solid var(--focus,#1456c8);outline-offset:2px}" +
    ".cc-link{background:none;border:0;padding:0;font:inherit;color:var(--accent,#0a7358);text-decoration:underline;" +
    "text-underline-offset:.18em;cursor:pointer}" +
    "@keyframes cc-in{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}" +
    "@media (prefers-reduced-motion:reduce){.cc-banner{animation:none}}" +
    "@media print{.cc-banner{display:none}}";

  /* ---------- Cookie-rutan (HTML) ---------- */
  var banner = null;

  function reserveSpace() {
    // Gör plats längst ner så att rutan inte täcker sidfoten.
    document.body.style.paddingBottom = banner && !banner.hidden ? banner.offsetHeight + 24 + "px" : "";
  }

  function statusText() {
    var c = readChoice();
    if (c === "accepted") return "Ditt nuvarande val: Godkänt.";
    if (c === "rejected") return "Ditt nuvarande val: Nekat.";
    return "";
  }

  function showBanner(focus) {
    if (!banner) {
      banner = document.createElement("section");
      banner.className = "cc-banner";
      banner.setAttribute("role", "dialog");
      banner.setAttribute("aria-labelledby", "cc-title");
      banner.setAttribute("aria-describedby", "cc-text");
      banner.innerHTML =
        '<p class="cc-title" id="cc-title">Cookies och statistik</p>' +
        '<p id="cc-text">Vi vill se hur många som besöker sidan och vilka sidor som läses, med Google Analytics. ' +
        'Det sätter cookies i din webbläsare, men bara om du godkänner. Väljer du Neka, eller inte väljer alls, ' +
        'används ingen statistik. Kalkylatorerna fungerar lika bra oavsett, och du kan ändra dig när som helst ' +
        'under Cookieinställningar längst ner på sidan. Läs mer i vår <a href="integritetspolicy.html">integritetspolicy</a>.</p>' +
        '<p class="cc-status" id="cc-status"></p>' +
        '<div class="cc-actions">' +
        '<button type="button" class="cc-reject">Neka</button>' +
        '<button type="button" class="cc-accept">Godkänn</button>' +
        "</div>";
      banner.querySelector(".cc-accept").addEventListener("click", function () { choose("accepted"); });
      banner.querySelector(".cc-reject").addEventListener("click", function () { choose("rejected"); });
      document.body.appendChild(banner);
      window.addEventListener("resize", reserveSpace);
    }
    banner.hidden = false;
    banner.querySelector("#cc-status").textContent = statusText();
    reserveSpace();
    if (focus) banner.querySelector(".cc-reject").focus();
  }

  function hideBanner() {
    if (banner) banner.hidden = true;
    reserveSpace();
  }

  function choose(choice) {
    var previous = readChoice();
    saveChoice(choice);
    hideBanner();
    if (choice === "accepted") {
      loadAnalytics();
      return;
    }
    // Nekar besökaren efter att ha godkänt: stäng av, ta bort cookies och ladda om sidan.
    if (analyticsLoaded || previous === "accepted") {
      window["ga-disable-" + GA_MEASUREMENT_ID] = true;
      clearAnalyticsCookies();
      window.location.reload();
    }
  }

  /* ---------- Start ---------- */
  function init() {
    var openers = document.querySelectorAll("[data-cookie-settings]");

    // Utan giltigt mät-ID finns inget att ta samtycke till: dölj knappen och gör ingenting.
    if (!ID_OK) {
      Array.prototype.forEach.call(openers, function (b) {
        var li = b.closest ? b.closest("li") : null;
        (li || b).hidden = true;
      });
      return;
    }

    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var stored = readChoice();
    if (stored === "accepted") loadAnalytics();
    else if (!stored) showBanner(false);

    document.addEventListener("click", function (e) {
      var t = e.target;
      var opener = t && t.closest ? t.closest("[data-cookie-settings]") : null;
      if (opener) {
        e.preventDefault();
        showBanner(true);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
