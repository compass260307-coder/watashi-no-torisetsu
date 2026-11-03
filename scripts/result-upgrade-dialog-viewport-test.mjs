import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const effects = [], focus = [], scrolls = [];
const windowListeners = new Map(), viewportListeners = new Map();
const viewport = { height: 844, offsetTop: 0, addEventListener: (n,f) => viewportListeners.set(n,f), removeEventListener: n => viewportListeners.delete(n) };
const body = { style: { overflow: "auto", position: "", top: "", width: "" } };
const overlay = { style: {} };
const trigger = { focus: options => focus.push(options) };
const refs = [trigger, trigger, overlay];
const exports = {};
const jsx = { jsx: (type,props) => ({type,props}), jsxs: (type,props) => ({type,props}) };
const imports = {
  "react/jsx-runtime": jsx,
  react: { useEffect: f => effects.push(f), useState: () => [true,()=>{}], useRef: () => ({current:refs.shift()}) },
  "react-dom": { createPortal: value => value }, "next/dynamic": { default: () => "chat" },
  "next/navigation": {usePathname:()=>"/me/owner"},
  "@/i18n/result-upgrade": { RESULT_UPGRADE_COPY:{ja:{dialog:"chat"}} },
};
vm.runInNewContext(ts.transpileModule(readFileSync("src/components/result-upgrade/ResultUpgradeChatLauncher.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
  exports, require: name => { if (name in imports) return imports[name]; throw Error(name); },
  document: {body,activeElement:trigger},
  window: {scrollX:0,scrollY:650,innerHeight:844,visualViewport:viewport,addEventListener:(n,f)=>windowListeners.set(n,f),removeEventListener:n=>windowListeners.delete(n),scrollTo:options=>scrolls.push(options)},
});
exports.ResultUpgradeChatLauncher({ownerToken:"owner",premiumPaid:false,preview:true});
const cleanup = effects[1]();
assert.equal(body.style.position,"fixed");assert.equal(body.style.top,"-650px");
assert.equal(overlay.style.height,"844px");
viewport.height=390;viewport.offsetTop=12;viewportListeners.get("resize")();
assert.equal(overlay.style.height,"390px");assert.equal(overlay.style.top,"12px");
assert.equal(body.style.top,"-650px","Keyboard must not move the underlying result");
cleanup();assert.equal(body.style.position,"");assert.equal(body.style.overflow,"auto");
assert.equal(scrolls[0].top,650);assert.equal(viewportListeners.size,0);assert.equal(windowListeners.size,0);
assert(focus.every(options=>options.preventScroll));
console.log("PASS: keyboard viewport resizes only the overlay, background stays locked, listeners/styles/scroll restore on close.");
