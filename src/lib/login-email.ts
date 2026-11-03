export type LoginEmailLocale = "ja" | "en" | "ko" | "id";

const FONT = "'Noto Sans','Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,'Malgun Gothic',Arial,sans-serif";
const COPY = {
  ja: {
    brand: "ワタシのトリセツ", title: "ログインリンク", heading: "ログインリンクをお送りします",
    body: "下のボタンからログインしてください。",
    button: "ログインする", expiry: "有効期限は1時間・1回のみ利用できます",
    safety: "心当たりがない場合は、このメールを破棄してください。",
  },
  en: {
    brand: "Alice Personalities", title: "Your sign-in link", heading: "Your sign-in link",
    body: "Sign in using the button below to return to your personality results.",
    button: "Sign in", expiry: "Valid for 1 hour · Can only be used once",
    safety: "If you did not request this email, you can safely ignore it. No action is needed.",
  },
  ko: {
    brand: "나의 사용설명서", title: "로그인 링크", heading: "로그인 링크를 보내 드려요",
    body: "아래 버튼으로 로그인하고 나의 진단 결과를 확인해 보세요.",
    button: "로그인하기", expiry: "유효 시간 1시간 · 한 번만 사용할 수 있어요",
    safety: "요청한 적이 없다면 이 메일을 삭제해 주세요. 따로 조치하지 않아도 돼요.",
  },
  id: {
    brand: "Alice Personalities", title: "Tautan masuk Anda", heading: "Tautan masuk Anda",
    body: "Masuk melalui tombol di bawah untuk melihat kembali hasil kepribadian Anda.",
    button: "Masuk", expiry: "Berlaku selama 1 jam · Hanya untuk satu kali penggunaan",
    safety: "Jika Anda tidak meminta email ini, abaikan atau hapus saja. Tidak perlu melakukan apa pun.",
  },
} as const;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Email clients must render a useful message without webfonts, images or CSS files.
export type LoginEmailOptions = { code?: string; kind?: "login" | "welcome" };
const EXTRA = {
  ja: { heading: "ログインコードをお送りします", body: "ログイン画面に下の6桁のコードを入力してください。メールのボタンからもログインできます。", expiry: "有効期限は10分・1回のみ利用できます", welcome: "アカウントの登録について", welcomeBody: "ログインをリクエストいただきましたが、このメールアドレスに紐づく診断結果を確認できませんでした。", start: "無料の性格診断を受ける" },
  en: { heading: "Your sign-in code", body: "Enter the six-digit code on the sign-in screen, or use the button below.", expiry: "Valid for 10 minutes · One use only", welcome: "Get started", welcomeBody: "No account is linked to this email. Take the free personality test to create your results.", start: "Take the free test" },
  ko: { heading: "로그인 코드", body: "로그인 화면에 아래 6자리 코드를 입력하거나 버튼으로 로그인해 주세요.", expiry: "유효 시간 10분 · 한 번만 사용 가능", welcome: "계정 등록 안내", welcomeBody: "이메일에 연결된 계정이 없어요. 무료 성격 테스트로 나의 결과를 만들어 보세요.", start: "무료 성격 테스트" },
  id: { heading: "Kode masuk Anda", body: "Masukkan kode enam digit di layar masuk, atau gunakan tombol di bawah.", expiry: "Berlaku 10 menit · Satu kali penggunaan", welcome: "Mulai membuat akun", welcomeBody: "Belum ada akun yang terhubung ke email ini. Ikuti tes kepribadian gratis untuk membuat hasil Anda.", start: "Ikuti tes gratis" },
} as const;
const WELCOME = {
  ja: { invitation: "まだ診断を受けていない方は、無料の性格診断から、あなたの性格や行動の傾向を知ることができます。自分のトリセツを作ってみませんか。", returning: "すでに診断したことがある方は、診断や購入時に使ったメールアドレスでログインしてください。", retry: "別のメールアドレスでログイン" },
  en: { invitation: "New here? Take the free personality test to explore your personality and create your results.", returning: "If you have already taken the test, sign in with the email address used for your results or purchase.", retry: "Sign in with a different email" },
  ko: { invitation: "아직 테스트를 받지 않았다면 무료 성격 테스트로 나의 성격과 행동 경향을 알아보세요.", returning: "이미 테스트를 받았다면 진단이나 구매에 사용한 이메일로 로그인해 주세요.", retry: "다른 이메일로 로그인" },
  id: { invitation: "Belum mengikuti tes? Ikuti tes kepribadian gratis untuk mengenali kepribadian dan pola perilaku Anda.", returning: "Jika sudah mengikuti tes, masuk dengan email yang digunakan untuk hasil atau pembelian Anda.", retry: "Masuk dengan email lain" },
} as const;

export function renderLoginEmailHtml(url: string, locale: LoginEmailLocale, options: LoginEmailOptions = {}): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Invalid login link protocol");
  const href = escapeHtml(url);
  const extra = EXTRA[locale];
  const welcomeCopy = WELCOME[locale];
  const welcome = options.kind === "welcome";
  if (options.code && !/^\d{6}$/.test(options.code)) throw new Error("Invalid login code");
  const loginUrl = escapeHtml(new URL(locale === "ja" ? "/login" : `/${locale}/login`, parsed.origin).href);
  const c = { ...COPY[locale],
    ...(options.code ? { heading: extra.heading, body: extra.body, expiry: extra.expiry } : {}),
    ...(welcome ? { heading: extra.welcome, body: extra.welcomeBody, button: extra.start, expiry: "" } : {}),
  };
  const details = {
    ja: { greeting: "こんにちは。", signature: "ワタシのトリセツ運営事務局", footer: "このメールは送信専用アドレスからお送りしています。", contact: "お問い合わせ" },
    en: { greeting: "Hello,", signature: `The ${c.brand} team`, footer: "This email was sent from a send-only address.", contact: "Contact us" },
    ko: { greeting: "안녕하세요.", signature: `${c.brand} 팀`, footer: "이 메일은 발신 전용 주소에서 보냈어요.", contact: "문의하기" },
    id: { greeting: "Halo,", signature: `Tim ${c.brand}`, footer: "Email ini dikirim dari alamat khusus pengiriman.", contact: "Hubungi kami" },
  }[locale];
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${c.brand} - ${c.heading}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#F5F5F7;color:#51516B;font-family:${FONT};-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${c.body} ${c.expiry}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5F5F7" style="width:100%;border-collapse:collapse;">
<tr><td align="center" style="padding:24px 16px;font-family:${FONT};">
  <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;">
    <tr><td align="center" style="padding:32px 24px 36px;font-family:${FONT};color:#2E2E5C;text-align:center;font-size:22px;font-weight:700;line-height:1.5;">${c.brand}</td></tr>
    <tr><td style="padding:0 28px 32px;font-family:${FONT};">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.9;">${details.greeting}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.9;">${c.body}</p>
      ${welcome ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.9;">${welcomeCopy.invitation}</p>` : ""}
      ${options.code ? `<p style="margin:0 0 24px;font-family:${FONT};font-size:32px;font-weight:700;letter-spacing:8px;color:#2E2E5C;">${options.code}</p>` : ""}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="#5B5BEF" style="background-color:#5B5BEF;border-radius:999px;mso-padding-alt:13px 24px;">
          <a href="${href}" style="display:block;border:1px solid #5B5BEF;border-radius:999px;padding:13px 24px;font-family:${FONT};color:#FFFFFF;text-decoration:none;text-align:center;font-size:15px;font-weight:700;line-height:1.5;mso-padding-alt:0;">${c.button} &rarr;</a>
        </td>
      </tr></table>
      ${c.expiry ? `<p style="margin:16px 0 24px;color:#77778A;font-size:12px;line-height:1.8;">${c.expiry}</p>` : ""}
      ${welcome ? `<p style="margin:24px 0 10px;font-size:14px;line-height:1.9;">${welcomeCopy.returning}</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.9;"><a href="${loginUrl}" style="color:#5B5BEF;text-decoration:underline;">${welcomeCopy.retry}</a></p>` : ""}
      <p style="margin:24px 0 20px;font-size:14px;line-height:1.9;">${c.safety}</p>
      <p style="margin:0 0 32px;font-size:14px;line-height:1.9;">${details.signature}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E9E9F0;"><tr><td align="center" style="padding-top:28px;font-family:${FONT};text-align:center;color:#808092;font-size:11px;line-height:1.9;">
        ${details.footer}<br />
        ${details.contact}：<a href="mailto:support@watashi-torisetsu.com" style="color:#5B5BEF;text-decoration:underline;">support@watashi-torisetsu.com</a>
      </td></tr></table>
    </td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td align="center" style="padding:48px 16px 12px;font-family:${FONT};text-align:center;font-size:12px;line-height:1.9;color:#77778A;">
      <p style="margin:0 0 4px;color:#51516B;">ワタシのトリセツ運営事務局</p>
      <p style="margin:0 0 4px;">${locale === "ja" ? "運営：" : "Operator: "}Sora</p>
      <p style="margin:0 0 4px;"><a href="https://www.watashi-torisetsu.com/" style="color:#5B5BEF;text-decoration:underline;">https://www.watashi-torisetsu.com</a></p>
      <p style="margin:0;"><a href="https://www.watashi-torisetsu.com/legal/commerce" style="color:#77778A;text-decoration:underline;">${locale === "ja" ? "特定商取引法に基づく表記" : "Seller information"}</a></p>
      <p style="margin:24px 0 0;font-size:11px;">&copy; ${new Date().getUTCFullYear()} ${c.brand}. All rights reserved.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderLoginCodeText(url: string, locale: LoginEmailLocale, options: LoginEmailOptions) {
  const c = EXTRA[locale];
  return [COPY[locale].brand, options.kind === "welcome" ? c.welcomeBody : c.body,
    options.kind === "welcome" ? WELCOME[locale].invitation : "", options.code ?? "", options.kind === "welcome" ? "" : c.expiry, url,
    options.kind === "welcome" ? WELCOME[locale].returning : "", COPY[locale].safety].filter(Boolean).join("\n\n");
}
