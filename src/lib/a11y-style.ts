// アクセシビリティスタイル (ヘッダーのボタンから選ぶ、見え方の追加設定)。
//   contrast: 薄い文字を濃くして読みやすくする
//   motion  : アニメーション・画面の動きを抑える
//   focus   : キーボード操作中の要素をはっきりした枠で示す
// 選んだ内容はこの端末の localStorage だけに置く (サーバーへは送らない)。
// 見た目は <html> の data-a11y-* 属性で切り替える (globals.css の末尾を参照)。
// 「データをリセット」(reset-data.ts) では消さない: 診断データではなく見え方の好みのため。

export const A11Y_STYLE_STORAGE_KEY = "wt_a11y_style_v1";
export const A11Y_STYLE_CHANGE_EVENT = "wt:a11y-style-change";

export const A11Y_STYLE_KEYS = ["contrast", "motion", "focus"] as const;
export type A11yStyleKey = (typeof A11Y_STYLE_KEYS)[number];
export type A11yStyle = Record<A11yStyleKey, boolean>;

export const A11Y_STYLE_OFF: A11yStyle = {
  contrast: false,
  motion: false,
  focus: false,
};

// 初回描画の前に <html> へ属性を付ける (あとから付けると、再訪のたびに一瞬
// 通常の見た目が出てから切り替わる)。layout.tsx の <head> で同期実行する。
// 保存形式は有効な項目名を空白でつないだ文字列 (例: "contrast focus")。
export const A11Y_STYLE_INIT_SCRIPT = `(function(){try{
var v=localStorage.getItem('${A11Y_STYLE_STORAGE_KEY}');if(!v)return;
var d=document.documentElement,k=v.split(' ');
for(var i=0;i<k.length;i++){if(k[i]==='contrast'||k[i]==='motion'||k[i]==='focus')d.setAttribute('data-a11y-'+k[i],'');}
}catch(e){}})();`;

export function readA11yStyle(): A11yStyle {
  if (typeof document === "undefined") return A11Y_STYLE_OFF;
  // 画面に効いている状態 (<html> の属性) を正とする。localStorage が使えない
  // 環境でも、その表示中だけは切り替えが効くようにするため。
  const root = document.documentElement;
  return {
    contrast: root.hasAttribute("data-a11y-contrast"),
    motion: root.hasAttribute("data-a11y-motion"),
    focus: root.hasAttribute("data-a11y-focus"),
  };
}

export function setA11yStyle(style: A11yStyle) {
  const root = document.documentElement;
  const enabled: A11yStyleKey[] = [];
  for (const key of A11Y_STYLE_KEYS) {
    root.toggleAttribute(`data-a11y-${key}`, style[key]);
    if (style[key]) enabled.push(key);
  }
  try {
    if (enabled.length > 0) {
      localStorage.setItem(A11Y_STYLE_STORAGE_KEY, enabled.join(" "));
    } else {
      localStorage.removeItem(A11Y_STYLE_STORAGE_KEY);
    }
  } catch {
    // localStorage 不可環境: この表示中だけ有効 (次に開いたときは元に戻る)。
  }
  window.dispatchEvent(new Event(A11Y_STYLE_CHANGE_EVENT));
}

export function subscribeA11yStyle(onChange: () => void) {
  window.addEventListener(A11Y_STYLE_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(A11Y_STYLE_CHANGE_EVENT, onChange);
}

// 動きを抑えるべきか。端末側の設定 (prefers-reduced-motion) か、
// サイト内の「動きを抑える」のどちらかが有効なら true。
// スクリプトで動かしている演出 (自動スクロール・めくり・紙吹雪など) はこれで分岐する。
export function isMotionReduced(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.hasAttribute("data-a11y-motion")) return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
