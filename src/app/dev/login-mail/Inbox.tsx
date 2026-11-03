"use client";
import { useEffect, useState } from "react";
type Mail = {id:string; email:string; code:string|null; kind:string};
export default function Inbox() {
  const [mails, setMails] = useState<Mail[]>([]);
  const refresh = async () => { const res = await fetch("/api/dev/login-mail", {cache:"no-store"}); if(res.ok) setMails((await res.json()).mails); };
  useEffect(() => {
    const load = () => { void fetch("/api/dev/login-mail", {cache:"no-store"}).then(res=>res.ok?res.json():null).then(data=>{if(data) setMails(data.mails);}).catch(()=>{}); };
    load(); const timer=setInterval(load,3000); return ()=>clearInterval(timer);
  },[]);
  return <main className="mx-auto max-w-2xl p-6 text-[#2E2E5C]">
    <h1 className="text-2xl font-bold">ログインメール・ローカル受信箱</h1>
    <p className="my-4 leading-relaxed">実メールの送信・本番アカウントの変更はありません。<br />登録済み例：member@example.test ／ 未登録例：new@example.test</p>
    <p className="mb-6 text-sm">コードで進む先は架空の結果プレビューです。実アカウントへのログインではありません。</p>
    <button onClick={refresh} className="mb-4 rounded-full border px-5 py-2">更新する</button>
    {mails.length===0 && <p>ログインモーダルでメールアドレスを送信すると、ここに表示されます。</p>}
    {mails.map(mail=><article key={mail.id} className="mb-4 rounded-xl border p-4">
      <p className="break-all font-bold">{mail.email}</p>
      <p className="my-2">{mail.code ? <>認証コード：<strong className="text-2xl tracking-widest">{mail.code}</strong></> : "未登録者向け・無料診断のご案内"}</p>
      <a className="text-[#5B5BEF] underline" target="_blank" rel="noreferrer" href={`/api/dev/login-mail?id=${mail.id}`}>メールのデザインを確認</a>
    </article>)}
  </main>;
}
