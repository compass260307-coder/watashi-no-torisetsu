// Runs before Next's runtime, so recovery still works if the initial JS is missing.
// No normal-page requests, analytics, tokens, automatic reload or polling.
export const STATIC_ASSET_RECOVERY_SCRIPT = String.raw`(function(){
  if (window.__wtAssetRecovery) return;
  window.__wtAssetRecovery = true;
  var checked = new Set(), shown = false, missing = [];
  function show() {
    if (shown) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', show, {once:true});
      return;
    }
    shown = true;
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
    button(copy[1], function(){ location.reload(); });
    button(copy[2], function(){ box.remove(); });
    document.body.appendChild(box);
  }
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
      show();
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
