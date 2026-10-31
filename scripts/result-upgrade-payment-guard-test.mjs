import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function compile(path,imports,globals={},source=readFileSync(path,'utf8')) {
 const exports={};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,console,...globals,require(name){if(name in imports)return imports[name];throw new Error(`Unexpected import: ${name}`);}});
 return exports;
}
async function page({paid=false,ready=false}={}) {
 const service=compile('src/app/result-upgrade/page.tsx',{
  'react/jsx-runtime':jsx,'next/navigation':{redirect:url=>{throw new Error('redirect:'+url);}},
  '@/components/top/TopHeader':{default:'header'},'@/components/top/TopFooter':{default:'footer'},
  '@/components/result-upgrade/LineResultUpgradeLink':{LineResultUpgradeLink:'line-link'},'./LineResultUpgradeLink':{LineResultUpgradeLink:'line-link'},
  '@/lib/entitlements':{hasFullAccess:async()=>true,hasPremiumBundleAccess:async()=>paid},
  '@/lib/session':{getSession:async()=>({id:'owner',owner_token:'owner-token'})},
  '@/lib/result-upgrade-server':{loadResultUpgradeForUser:async()=>({state:ready?'ready':'answers_ready'})},
  '@/lib/result-upgrade':{isResultUpgradeReady:row=>row.state==='ready'},
 });
 try{return await service.default();}catch(error){return error.message;}
}
function nodes(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)];}
for(const paid of [false,true]) {
 const tree=await page({paid});assert(nodes(tree).some(n=>n.type==='line-link'));
}
assert(nodes(await page({paid:false,ready:true})).some(n=>n.type==='line-link'),'Stored result never bypasses unpaid LINE purchase path');
assert.equal(await page({paid:true,ready:true}),'redirect:/result-upgrade/reading','Existing paid results remain accessible');
const launcher=compile('src/components/result-upgrade/ResultUpgradeChatLauncher.tsx',{
 'react/jsx-runtime':jsx,react:{useEffect:()=>{},useState:value=>[value,()=>{}],useRef:value=>({current:value})},
 'react-dom':{createPortal:()=>{throw new Error('Unexpected Web chat');}},'next/dynamic':{default:()=> 'web-chat'},
 'next/navigation':{usePathname:()=>'/me/owner'},'@/i18n/result-upgrade':{RESULT_UPGRADE_COPY:{ja:{}}},
 '@/components/result-upgrade/LineResultUpgradeLink':{LineResultUpgradeLink:'line-link'},'./LineResultUpgradeLink':{LineResultUpgradeLink:'line-link'},
});
for(const premiumPaid of [false,true])assert.equal(launcher.ResultUpgradeChatLauncher({locale:'ja',ownerToken:'owner',premiumPaid}).type,'line-link');
// Run the result-loading expression from the actual server component with a DB spy.
const source=readFileSync('src/components/result/MeResultPage.tsx','utf8');
const expression=source.slice(source.indexOf('  const resultUpgrade ='),source.indexOf('  const resultUpgradeReady ='));
for(const premiumBundlePaid of [false,true]) {
 let reads=0;
 const mod=compile('result-page-load',{}, {previewResultUpgrade:null,locale:'ja',isKorean:false,ownsResultSession:true,fullAccessPaid:true,premiumBundlePaid,user:{id:'owner'},loadResultUpgradeForUser:async()=>{reads++;return {state:'ready'};}},'exports.load=async()=>{'+expression+'return resultUpgrade;};');
 const row=await mod.load();assert.equal(reads,premiumBundlePaid?1:0);assert.equal(Boolean(row),premiumBundlePaid);
}
console.log('PASS: Japanese Web entries use LINE for paid/unpaid drafts; paid readings survive; stored results are never loaded for unpaid result viewers. No external calls.');
