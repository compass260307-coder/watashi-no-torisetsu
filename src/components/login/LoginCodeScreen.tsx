"use client";
import { useEffect, useRef, useState } from "react";
type Locale = "ja" | "en" | "ko" | "id";
const COPY = {
 ja: {heading:"ログインコードを入力", body:"このメールアドレスが登録されている場合、6桁の認証コードとログインリンクをお送りしました。未登録の場合は、メールの案内をご確認ください。コードとリンクは10分間有効です。", label:"6桁の認証コード", submit:"ログインする", verifying:"確認中…", resend:"新しいコードをリクエスト", wait:"秒後に再送できます", reset:"別のメールアドレスを入力", error:"コードが違うか、有効期限が切れています。メールを確認するか、新しいコードをリクエストしてください。", network:"通信できませんでした。もう一度お試しください。"},
 en: {heading:"Enter your sign-in code",body:"If this email is registered, we sent a six-digit code and sign-in link. Otherwise, check your email for getting-started instructions. Codes and links expire in 10 minutes.",label:"Six-digit sign-in code",submit:"Sign in",verifying:"Checking…",resend:"Request a new code",wait:"seconds until resend",reset:"Use a different email",error:"The code is incorrect or expired. Check your email or request a new code.",network:"Unable to connect. Please try again."},
 ko: {heading:"로그인 코드 입력",body:"등록된 이메일이라면 6자리 코드와 링크를 보냈어요. 미등록 이메일이라면 메일의 시작 안내를 확인해 주세요. 코드와 링크는 10분간 유효해요.",label:"6자리 로그인 코드",submit:"로그인",verifying:"확인 중…",resend:"새 코드 받기",wait:"초 후 다시 받을 수 있어요",reset:"다른 이메일 입력",error:"코드가 다르거나 만료되었어요. 메일을 확인하거나 새 코드를 받아 주세요.",network:"연결할 수 없어요. 다시 시도해 주세요."},
 id: {heading:"Masukkan kode masuk",body:"Jika email ini terdaftar, kami mengirim kode enam digit dan tautan masuk. Jika belum, periksa petunjuk di email. Kode dan tautan berlaku 10 menit.",label:"Kode masuk enam digit",submit:"Masuk",verifying:"Memeriksa…",resend:"Minta kode baru",wait:"detik hingga kirim ulang",reset:"Gunakan email lain",error:"Kode salah atau kedaluwarsa. Periksa email atau minta kode baru.",network:"Tidak dapat terhubung. Coba lagi."},
};
export default function LoginCodeScreen({ email, initialChallenge, locale, preview, onReset }: {
 email:string; initialChallenge:string; locale:Locale; preview:boolean; onReset:()=>void;
}) {
 const c=COPY[locale];
 const [challenge,setChallenge]=useState(initialChallenge);
 const [code,setCode]=useState("");
 const [remaining,setRemaining]=useState(60);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{ input.current?.focus(); },[]);
 useEffect(()=>{ const timer=setInterval(()=>setRemaining(n=>Math.max(0,n-1)),1000); return ()=>clearInterval(timer); },[]);
 const verify=async(e:React.FormEvent)=>{
  e.preventDefault(); if(busy || code.length!==6) return;
  setBusy(true);setError("");
  try {
   const res=await fetch("/api/auth/verify-code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,challenge,code,locale})});
   const data=await res.json();
   if(!res.ok || typeof data.redirect!=="string" || !data.redirect.startsWith("/") || data.redirect.startsWith("//")){setError(c.error);setBusy(false);return;}
   window.location.assign(data.redirect);
  }catch{setError(c.network);setBusy(false);}
 };
 const resend=async()=>{
  if(busy || remaining>0) return;
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/auth/request-magic-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,locale})});
   const data=await res.json();
   if(res.ok && typeof data.challenge==="string") {setChallenge(data.challenge);setCode("");setRemaining(data.retryAfter??60);input.current?.focus();}
   else {setRemaining(data.retryAfter??60);setError(res.status===429?"":c.network);}
  }catch{setError(c.network);}
  setBusy(false);
 };
 return <div className="text-[#2E2E5C]">
  <h2 className="pr-7 text-[22px] font-bold leading-relaxed sm:text-[28px]">{c.heading}</h2>
  <p className="mt-3 break-all text-sm font-bold">{email}</p>
  <p className="mt-2 text-[13px] leading-[1.9] text-[#62627A]">{c.body}</p>
  {preview && <p className="mt-3 rounded-lg bg-[#F1F1F7] p-3 text-xs leading-relaxed">ローカルデモ：実メールは送信していません。<a href="/dev/login-mail" target="_blank" rel="noreferrer" className="ml-1 text-[#5B5BEF] underline">確認用の受信箱を開く</a></p>}
  <form onSubmit={verify} className="mt-6">
   <div className="relative rounded-lg focus-within:ring-2 focus-within:ring-[#5B5BEF]/40">
    <div aria-hidden="true" className="grid grid-cols-6 overflow-hidden rounded-lg border border-[#BDBDD0]">
     {Array.from({length:6},(_,i)=><span key={i} className="flex h-14 items-center justify-center border-r border-[#BDBDD0] text-2xl last:border-0">{code[i]??""}</span>)}
    </div>
    <input ref={input} aria-label={c.label} autoComplete="one-time-code" inputMode="numeric" type="text" pattern="[0-9]{6}" maxLength={6}
     value={code} onPaste={e=>{ const digits=e.clipboardData.getData("text").replace(/\D/g,""); if(digits.length===6){e.preventDefault();setCode(digits);setError("");} }} onChange={e=>{setCode(e.target.value.replace(/\D/g,""));setError("");}} disabled={busy}
     className="absolute inset-0 h-full w-full rounded-lg border-0 bg-transparent text-transparent caret-transparent focus:outline-none" />
   </div>
   {error && <p role="alert" className="mt-3 text-[13px] leading-relaxed text-red-700">{error}</p>}
   <button disabled={busy||code.length!==6} className="mt-4 w-full rounded-full bg-[#5B5BEF] py-3.5 font-bold text-white disabled:opacity-40">{busy?c.verifying:c.submit}</button>
  </form>
  <div className="mt-5 text-center">
   <button type="button" onClick={resend} disabled={busy||remaining>0} className="rounded-full border border-[#DDDDEA] px-6 py-3 text-sm font-bold disabled:opacity-40">{c.resend}</button>
   <p role="status" className="mt-2 min-h-5 text-xs text-[#72728A]">{remaining>0?`${remaining} ${c.wait}`:""}</p>
   <button type="button" onClick={onReset} disabled={busy} className="mt-5 text-sm text-[#5B5BEF] underline underline-offset-4">{c.reset}</button>
  </div>
 </div>;
}
