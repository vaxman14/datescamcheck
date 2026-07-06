/* DateScamCheck.com — front-end logic */
(function () {
  "use strict";

  var FUNCTION_URL = "/.netlify/functions/reverse-image";

  var tabUrl = document.getElementById("tab-url");
  var tabFile = document.getElementById("tab-file");
  var panelUrl = document.getElementById("panel-url");
  var panelFile = document.getElementById("panel-file");
  var imgUrl = document.getElementById("imgUrl");
  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var preview = document.getElementById("preview");
  var previewImg = document.getElementById("previewImg");
  var checkBtn = document.getElementById("checkBtn");
  var spinner = document.getElementById("spinner");
  var message = document.getElementById("message");
  var resultArea = document.getElementById("resultArea");

  var mode = "url";       // "url" | "file"
  var selectedFile = null;

  /* ---------- Tabs ---------- */
  function setMode(next) {
    mode = next;
    var isUrl = next === "url";
    tabUrl.classList.toggle("active", isUrl);
    tabFile.classList.toggle("active", !isUrl);
    panelUrl.style.display = isUrl ? "" : "none";
    panelFile.style.display = isUrl ? "none" : "";
    clearMessage();
    hidePreview();
    resultArea.innerHTML = "";
  }

  tabUrl.addEventListener("click", function () { setMode("url"); });
  tabFile.addEventListener("click", function () { setMode("file"); });

  /* ---------- Messages ---------- */
  function showMessage(text, kind) {
    message.innerHTML = '<div class="notice ' + kind + '">' + escapeHtml(text) + "</div>";
  }
  function clearMessage() { message.innerHTML = ""; }

  /* ---------- Preview ---------- */
  function showPreview(src) {
    previewImg.src = src;
    preview.style.display = "block";
  }
  function hidePreview() {
    preview.style.display = "none";
    previewImg.removeAttribute("src");
  }

  /* ---------- URL preview (debounced) ---------- */
  var urlTimer = null;
  imgUrl.addEventListener("input", function () {
    clearMessage();
    resultArea.innerHTML = "";
    if (urlTimer) clearTimeout(urlTimer);
    var val = imgUrl.value.trim();
    if (!val) { hidePreview(); return; }
    urlTimer = setTimeout(function () {
      if (isValidHttpUrl(val)) showPreview(val); else hidePreview();
    }, 400);
  });

  /* ---------- File upload ---------- */
  dropzone.addEventListener("click", function () { fileInput.click(); });

  dropzone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropzone.classList.add("drag");
  });
  dropzone.addEventListener("dragleave", function () {
    dropzone.classList.remove("drag");
  });
  dropzone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropzone.classList.remove("drag");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    clearMessage();
    resultArea.innerHTML = "";
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      showMessage("Please choose a JPG or PNG image.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showMessage("That image is over 5 MB. Please choose a smaller one.", "error");
      return;
    }
    selectedFile = file;
    var reader = new FileReader();
    reader.onload = function (e) { showPreview(e.target.result); };
    reader.readAsDataURL(file);
  }

  /* ---------- Check button ---------- */
  checkBtn.addEventListener("click", function () {
    clearMessage();
    var agree = document.getElementById("agree");
    if (!agree || !agree.checked) {
      showMessage("Please read and agree to the Terms of Use before running a check.", "error");
      return;
    }
    resultArea.innerHTML = "";
    if (mode === "url") runUrlCheck();
    else runFileCheck();
  });

  function runUrlCheck() {
    var url = imgUrl.value.trim();
    if (!url) { showMessage("Paste the web address of the profile photo first.", "error"); return; }
    if (!isValidHttpUrl(url)) {
      showMessage("That doesn't look like a valid image URL. It should start with http:// or https://", "error");
      return;
    }
    showPreview(url);
    setLoading(true);

    fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: url })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      })
      .then(function (r) {
        setLoading(false);
        if (!r.ok || (r.data && r.data.error)) {
          handleApiError(r.data, url);
          return;
        }
        renderResults(r.data, url);
      })
      .catch(function () {
        setLoading(false);
        showMessage("We couldn't reach the search service. Check your connection and try again.", "error");
        renderManualFallback(url);
      });
  }

  function runFileCheck() {
    if (!selectedFile) {
      showMessage("Choose a photo to upload first.", "error");
      return;
    }
    // Uploaded files have no public URL, so SerpApi can't fetch them.
    // Send the user to Google Lens, which accepts direct uploads.
    resultArea.innerHTML =
      '<div class="card">' +
        '<div class="notice info">Next step: Google Lens. Upload this exact photo there and it shows everywhere the image appears online, the fastest way to spot a stolen or fake profile pic. Then use the warning signs on the ' +
        '<a href="/how-it-works.html">How It Works</a> page to read the results.</div>' +
        '<div class="btn-row"><a class="btn" href="https://lens.google.com/" target="_blank" rel="noopener">🔍 Open Google Lens to search</a></div>' +
        '<div class="btn-row"><a class="btn secondary" href="https://images.google.com/" target="_blank" rel="noopener">Or use Google Images</a></div>' +
      "</div>";
    scrollToResults();
  }

  /* ---------- API error handling ---------- */
  function handleApiError(data, url) {
    var code = data && data.error ? data.error : "unknown";
    var msg;
    if (code === "not_configured") {
      msg = "The automated checker isn't switched on yet (no SerpApi key set). You can still search this photo manually with Google Lens below.";
    } else if (code === "quota") {
      msg = "This month's free automated searches are used up. You can still search this photo manually with Google Lens below.";
    } else if (code === "bad_image") {
      msg = "We couldn't load that image. Make sure the URL points directly to a photo (it should end in .jpg or .png).";
    } else {
      msg = "Something went wrong with the search. Try the manual Google Lens search below.";
    }
    showMessage(msg, code === "bad_image" ? "error" : "tip");
    if (code !== "bad_image") renderManualFallback(url);
  }

  function renderManualFallback(url) {
    var lens = "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(url);
    resultArea.innerHTML =
      '<div class="card">' +
        '<h3>Search this photo manually</h3>' +
        '<p style="margin:6px 0 14px;color:#5a6a82">Google Lens is free and shows everywhere this image appears.</p>' +
        '<a class="btn" href="' + escapeAttr(lens) + '" target="_blank" rel="noopener">🔍 Open in Google Lens</a>' +
      "</div>";
    scrollToResults();
  }

  /* ---------- Render results ---------- */
  function renderResults(data, url) {
    var matches = Array.isArray(data.matches) ? data.matches : [];
    var verdict = data.verdict || "warn";
    var info = verdictInfo(verdict, data, matches.length);

    var html = '<div class="verdict ' + info.cls + '">' +
      '<div class="emoji">' + info.emoji + "</div>" +
      "<h2>" + info.title + "</h2>" +
      "<p>" + escapeHtml(data.summary || info.fallback) + "</p>" +
      "</div>";

    html += '<div class="card results">';
    if (matches.length) {
      html += "<h3>Found this photo on " + matches.length + " place" + (matches.length === 1 ? "" : "s") + "</h3>";
      matches.forEach(function (m) {
        var thumb = m.thumbnail
          ? '<img class="thumb" src="' + escapeAttr(m.thumbnail) + '" alt="" loading="lazy" />'
          : '<div class="thumb"></div>';
        html += '<div class="match">' + thumb +
          '<div class="meta">' +
            '<a href="' + escapeAttr(m.link) + '" target="_blank" rel="noopener">' + escapeHtml(m.title || m.source || m.link) + "</a>" +
            '<div class="src">' + escapeHtml(m.source || hostOf(m.link)) + "</div>" +
          "</div></div>";
      });
    } else {
      html += "<h3>No clear matches found</h3>" +
        '<p style="color:#5a6a82">We didn\'t find this exact photo elsewhere. That\'s common for genuine private people — but a brand-new fake photo may not be indexed yet, so stay alert.</p>';
    }

    var lens = "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(url);
    html += '<div class="btn-row"><a class="btn secondary" href="' + escapeAttr(lens) +
      '" target="_blank" rel="noopener">Double-check on Google Lens</a></div>';
    html += "</div>";

    html += '<div class="notice tip">This is guidance, not proof. Combine it with the warning signs on the ' +
      '<a href="/how-it-works.html">How It Works</a> page, and never send money to someone you haven\'t met in person.</div>';

    resultArea.innerHTML = html;
    scrollToResults();
  }

  function verdictInfo(verdict, data, count) {
    if (verdict === "ok") {
      return {
        cls: "ok", emoji: "✅", title: "Likely Real",
        fallback: "This photo barely appears online — normal for a genuine private person."
      };
    }
    if (verdict === "bad") {
      return {
        cls: "bad", emoji: "🚨", title: "Likely Fake",
        fallback: "This photo is widely circulated online — a classic sign of a stolen image."
      };
    }
    return {
      cls: "warn", emoji: "⚠️", title: "Suspicious",
      fallback: "We found some matches worth a closer look. Proceed carefully."
    };
  }

  /* ---------- Helpers ---------- */
  function setLoading(on) {
    spinner.style.display = on ? "block" : "none";
    checkBtn.disabled = on;
    checkBtn.textContent = on ? "Checking…" : "🔍 Check this profile";
  }

  function scrollToResults() {
    if (resultArea.firstChild) {
      resultArea.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function isValidHttpUrl(str) {
    try {
      var u = new URL(str);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) { return false; }
  }

  function hostOf(link) {
    try { return new URL(link).hostname.replace(/^www\./, ""); }
    catch (e) { return link || ""; }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
