/* DateScamCheck.com — cookie consent banner + gated ad loading.
 *
 * Google AdSense (and its advertising cookies) only loads AFTER the visitor
 * makes a choice. "Accept" allows personalised ads; "Reject" loads ads in
 * non-personalised mode. The choice is stored in localStorage.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "dsc_cookie_consent";
  // Replace with your real AdSense publisher ID before going live.
  var ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX";

  var adsLoaded = false;

  function readChoice() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function saveChoice(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) {}
  }

  /* ---- Load AdSense ---- */
  function loadAds(personalized) {
    if (adsLoaded) return;
    adsLoaded = true;

    window.adsbygoogle = window.adsbygoogle || [];
    if (!personalized) {
      // Non-personalised ads — no advertising-profile cookies used.
      window.adsbygoogle.requestNonPersonalizedAds = 1;
    }

    var script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + ADSENSE_CLIENT;
    script.onload = fillAdSlots;
    document.head.appendChild(script);
  }

  function fillAdSlots() {
    var slots = document.querySelectorAll("ins.adsbygoogle");
    for (var i = 0; i < slots.length; i++) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    }
  }

  /* ---- Banner ---- */
  function buildBanner() {
    var banner = document.createElement("div");
    banner.className = "cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookie consent");
    banner.innerHTML =
      '<div class="cb-wrap">' +
        "<p>We use cookies to show ads that keep DateScamCheck free to use. " +
        'Choose "Accept" for personalised ads, or "Reject" for non-personalised ' +
        'ads only. See our <a href="/privacy.html">Privacy Policy</a>.</p>' +
        '<div class="cb-actions">' +
          '<button type="button" class="cb-reject">Reject</button>' +
          '<button type="button" class="cb-accept">Accept</button>' +
        "</div>" +
      "</div>";

    banner.querySelector(".cb-accept").addEventListener("click", function () {
      saveChoice("accepted");
      removeBanner(banner);
      loadAds(true);
    });
    banner.querySelector(".cb-reject").addEventListener("click", function () {
      saveChoice("rejected");
      removeBanner(banner);
      loadAds(false);
    });

    return banner;
  }

  function removeBanner(banner) {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
  }

  function showBanner() {
    var existing = document.querySelector(".cookie-banner");
    if (existing) return;
    document.body.appendChild(buildBanner());
  }

  /* ---- "Cookie Preferences" footer link ---- */
  function wirePreferencesLink() {
    var links = document.querySelectorAll(".cookie-link");
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function (e) {
        e.preventDefault();
        showBanner();
      });
    }
  }

  /* ---- Init ---- */
  function init() {
    wirePreferencesLink();
    var choice = readChoice();
    if (choice === "accepted") loadAds(true);
    else if (choice === "rejected") loadAds(false);
    else showBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
