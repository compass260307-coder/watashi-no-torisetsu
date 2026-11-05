// Runs before Next's runtime, so recovery still works if the initial JS is missing.
// Also served for missing legacy JS: already-open pages cannot receive a new layout script.
// No checkout requests or analytics. Only saved result pages may refresh automatically.
export const STATIC_ASSET_RECOVERY_SCRIPT = String.raw`(function(){
  if (window.__wtRecoverMissingAssetV2) return;
  var checked = new Set(), shown = false, missing = [];
  function show() {
    if (shown) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', show, {once:true});
      return;
    }
    shown = true;
    var previous = document.getElementById('wt-asset-recovery');
    if (previous) previous.remove();
    var locale = location.pathname.split('/')[1];
    var copy = {
      ja: ['ページの一部を読み込めませんでした。更新すると、入力中の内容が失われる場合があります。', 'ページを更新', '閉じる'],
      ko: ['페이지 일부를 불러오지 못했습니다. 새로고침하면 입력 중인 내용이 사라질 수 있습니다.', '새로고침', '닫기'],
      en: ['Part of this page could not load. Reloading may discard unsaved answers.', 'Reload page', 'Dismiss'],
      id: ['Sebagian halaman gagal dimuat. Memuat ulang dapat menghapus jawaban yang belum disimpan.', 'Muat ulang', 'Tutup'],
      th: ['โหลดบางส่วนของหน้าไม่ได้ การโหลดใหม่อาจทำให้คำตอบที่ยังไม่ได้บันทึกหายไป', 'โหลดหน้าใหม่', 'ปิด']
    }[locale] || ['ページの一部を読み込めませんでした。更新すると、入力中の内容が失われる場合があります。', 'ページを更新', '閉じる'];
    var box = document.createElement('aside');
    box.id = 'wt-asset-recovery';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;z-index:2147483647;top:12px;left:12px;right:12px;max-width:620px;margin:auto;padding:16px;border:1px solid #ddd;border-radius:12px;background:#fff;color:#242442;box-shadow:0 4px 24px #0003;font:14px/1.5 system-ui,sans-serif';
    var message = document.createElement('p');
    message.textContent = copy[0];
    message.style.cssText = 'margin:0 0 12px';
    box.appendChild(message);
    function button(label, action) {
      var el = document.createElement('button');
      el.type = 'button'; el.textContent = label;
      el.style.cssText = 'font:inherit;margin:0 12px 0 0;padding:8px 12px;border:1px solid #555;border-radius:8px;background:#fff;color:#242442;cursor:pointer';
      el.addEventListener('click', action); box.appendChild(el);
    }
    button(copy[1], refresh);
    button(copy[2], function(){ box.remove(); });
    document.body.appendChild(box);
  }
  function refresh() {
    // Bypass cached HTML, preserving the owner URL, attribution, checkout return and hash.
    var destination = new URL(location.href);
    destination.searchParams.set('_wt_asset_refresh', String(Date.now()));
    location.replace(destination.href);
  }
  var edited = false, recovering = false;
  document.addEventListener('input', function(){ edited = true; }, true);
  document.addEventListener('change', function(){ edited = true; }, true);
  function recover() {
    if (recovering) return;
    recovering = true;
    function ready() {
      var savedResult = /^\/(?:en\/|ko\/|id\/)?me\/[^/]+\/?$/.test(location.pathname);
      var hasDraft = edited || !!document.querySelector('dialog[open], [aria-modal="true"], [contenteditable="true"]');
      document.querySelectorAll('input, textarea, select').forEach(function(el){
        if (el.disabled || el.readOnly) return;
        if (el.tagName === 'SELECT') {
          if (Array.from(el.options).some(function(option){ return option.selected !== option.defaultSelected; })) hasDraft = true;
        } else if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.checked !== el.defaultChecked) hasDraft = true;
        } else if (!/^(hidden|button|submit|reset)$/.test(el.type) &&
          (el.value !== el.defaultValue || el.value)) hasDraft = true;
      });
      if (savedResult && !hasDraft) {
        try {
          var key = 'wt_asset_recovery_attempt_v2', now = Date.now();
          var last = Number(sessionStorage.getItem(key));
          if (!last || now - last > 60000) {
            // Timestamp only: do not persist owner tokens, URLs or answers in diagnostics.
            sessionStorage.setItem(key, String(now));
            refresh();
            return;
          }
        } catch (_) { /* Without tab storage, use the manual action to avoid a reload loop. */ }
      }
      show();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true});
    else ready();
  }
  window.__wtRecoverMissingAssetV2 = recover;
  function check(value) {
    if (!value || checked.size >= 3 || typeof fetch !== 'function') return;
    var url;
    try { url = new URL(value, location.href); } catch (_) { return; }
    if (url.origin !== location.origin || !/^\/_next\/static\/.+\.(js|css)$/.test(url.pathname) || checked.has(url.href)) return;
    checked.add(url.href);
    // Preserve dpl so the check uses exactly the same deployment as the failed asset.
    fetch(url.href, {method:'HEAD', credentials:'same-origin', cache:'no-store'}).then(function(response){
      if (response.status !== 404) return;
      missing.push({path:url.pathname, deployment:url.searchParams.get('dpl'), status:404});
      // Local diagnostic record only; never record the user's page URL or answers.
      try { sessionStorage.setItem('wt_missing_static_assets_v1', JSON.stringify(missing)); } catch (_) {}
      recover();
    }).catch(function(){});
  }
  window.addEventListener('error', function(event){
    var target = event.target;
    if (!target) return;
    if (target.tagName === 'SCRIPT') check(target.src);
    if (target.tagName === 'LINK' && target.rel === 'stylesheet') check(target.href);
  }, true);
  window.addEventListener('unhandledrejection', function(event){
    var reason = event.reason;
    var message = reason && typeof reason.message === 'string' ? reason.message : '';
    if (!/Loading (?:CSS )?chunk|Failed to load chunk|dynamically imported module/i.test(message)) return;
    var paths = message.match(/(?:https?:\/\/[^\s"'()]+)?\/_next\/static\/[^\s"'()]+/g) || [];
    paths.slice(0, 3).forEach(check);
  });
})();`;

// The fallback does not impersonate a React/Next chunk: it only restores a fresh document.
export const MISSING_STATIC_ASSET_BOOTSTRAP = STATIC_ASSET_RECOVERY_SCRIPT +
  "\nwindow.__wtRecoverMissingAssetV2();\n";
