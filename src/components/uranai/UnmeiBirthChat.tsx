"use client";

// 運命の設計図 (/unmei) の出生情報入力をチャット形式で行う (2026-08-05 指示)。
// 星読みの案内人 (フクロウ / mascot/unmei-guide.webp) が1問ずつ聞いていく。
//
// 方針:
//   - チャットアプリの1画面に見える構成 (2026-08-05 参考画像):
//     紺のヘッダーバー (アバター+名前) / 淡色トーク面 (内部スクロール)。
//   - 入力UIは下部の常設コンポーザーではなく「会話内のユーザー側カード」として出す
//     (2026-08-05 指示)。質問への回答がそのまま吹き出しになる流れに揃える。
//   - 「わからない」「スキップ」「◯◯を直す」は入力カード直上のクイックリプライ
//     チップ (LINE 流) にする。
//   - 質問は3つだけ (生年月日[必須] / 出生時刻[わからない可] / 出生地[スキップ可])。
//     送信前に確認バブルを挟み、各項目を修正できる (誤入力のまま生成が最悪ケースのため)。
//   - 演出のタイピング待ちは 1 バブル 500ms。3問しかないので待たせない。
//   - API (/api/birth-profile) と計測 (birth_form_view / birth_form_submit) は
//     既存フォームと同一。metadata.ui="chat" だけ足してファネル比較できるようにする。
//   - 保存後は親 (UnmeiClient) が waiting=true を渡してくる間、「星を読んでいます」
//     バブルを出し続ける (画面遷移なしで生成待ちへつなぐ)。

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { PREFS } from "@/components/birth/BirthProfileForm";
import UnmeiEmbeddedCheckout from "@/components/uranai/UnmeiEmbeddedCheckout";
import { track } from "@/lib/track";

type Role = "guide" | "user";
type Msg = { id: number; role: Role; text: string };
type Step =
  | "boot"
  | "date"
  | "time"
  | "place"
  | "confirm"
  | "submitting"
  | "payment"; // purchase モード: 出生情報保存後の決済ステップ
type Editing = null | "date" | "time" | "place";

const GUIDE_NAME = "星読みの案内人";
const TYPE_DELAY_MS = 500;

// 生年月日セレクトの範囲 (validate と同じ 120 年)
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 120 }, (_, i) => THIS_YEAR - i);

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

// 入力カード右下の丸い送信ボタン (チャットアプリの流儀)
function SendButton({
  onClick,
  disabled,
  label = "送信",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#5B5BEF] text-white transition-opacity disabled:opacity-30"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </button>
  );
}

// クイックリプライのチップ (入力カード直上に置く小さな選択肢ボタン)
function Chip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[#5B5BEF]/35 bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#5B5BEF]"
    >
      {children}
    </button>
  );
}

export default function UnmeiBirthChat({
  onSaved,
  waiting = false,
  mode = "input",
  ownerToken = null,
  product = "unmei",
}: {
  // input:    購入済みの出生情報入力 (保存→即 onSaved で生成)。従来。
  // purchase: 未購入。入力→保存→チャット内決済→決済完了で onSaved (生成へ)。
  onSaved: () => void;
  waiting?: boolean;
  mode?: "input" | "purchase";
  ownerToken?: string | null;
  product?: "unmei" | "unmei_upgrade";
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState<Step>("boot");
  const [editing, setEditing] = useState<Editing>(null);

  // 入力カードの作業値
  const [dYear, setDYear] = useState("");
  const [dMonth, setDMonth] = useState("");
  const [dDay, setDDay] = useState("");
  const [dockTime, setDockTime] = useState("12:00");
  const [dockPref, setDockPref] = useState("");
  const [dockCity, setDockCity] = useState("");

  // 確定した回答 (確認バブル・送信はここから読む。state の非同期更新に依存しない)
  const answersRef = useRef({
    birthDate: "", // YYYY-MM-DD
    birthDateLabel: "",
    birthTime: "12:00",
    timeUnknown: false,
    prefecture: "",
    city: "",
  });

  const idRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const push = useCallback((role: Role, text: string) => {
    idRef.current += 1;
    setMessages((m) => [...m, { id: idRef.current, role, text }]);
  }, []);

  // 案内人の発言を1バブルずつ遅延表示。最後のバブルの後に done を呼ぶ。
  const say = useCallback(
    (texts: string[], done?: () => void) => {
      setTyping(true);
      texts.forEach((t, i) => {
        const id = window.setTimeout(() => {
          push("guide", t);
          if (i === texts.length - 1) {
            setTyping(false);
            done?.();
          }
        }, TYPE_DELAY_MS * (i + 1));
        timersRef.current.push(id);
      });
    },
    [push],
  );

  useEffect(() => {
    const timers = timersRef.current; // 同じ配列インスタンスに push し続けるため参照で足りる
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  // 初回: 挨拶 → 生年月日へ (view 計測は既存フォームと同イベント)
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    track("birth_form_view", {
      metadata: {
        page: "unmei",
        ui: mode === "purchase" ? "chat_purchase" : "chat",
      },
    });
    // purchase モードは LP を経由せず直接来るため、最初に何をつくるかを一言添える。
    const intro =
      mode === "purchase"
        ? [
            "運命の設計図へようこそ。星の配置とあなたの性格から、あなただけの鑑定書をおつくりします。",
            "まずは、あなたが生まれた日を教えてください。",
          ]
        : [
            "ようこそ。ここからは、わたしがあなたの設計図づくりをお手伝いします。",
            "まずは、あなたが生まれた日を教えてください。",
          ];
    say(intro, () => setStep("date"));
  }, [say, mode]);

  // 新しい発言・入力UIの切り替わりでトーク面の末尾へスクロール (内部スクロール)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, typing, step, waiting]);

  // 確認バブル (修正後もここに戻る)
  const goConfirm = useCallback(() => {
    const a = answersRef.current;
    const timeLabel = a.timeUnknown ? "わからない（正午で計算）" : a.birthTime;
    const placeLabel = a.prefecture
      ? `${a.prefecture}${a.city ? ` ${a.city}` : ""}`
      : "未入力";
    say(
      [
        "それでは、この内容で設計図を描きます。",
        `生年月日：${a.birthDateLabel}\n出生時刻：${timeLabel}\n出生地：${placeLabel}`,
      ],
      () => setStep("confirm"),
    );
  }, [say]);

  // ---- 各ステップの回答ハンドラ ----

  const handleDateSubmit = useCallback(() => {
    const y = Number(dYear);
    const m = Number(dMonth);
    const d = Number(dDay);
    if (!y || !m || !d) return;
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (new Date(iso) > new Date()) {
      say(["未来の日付は選べないみたいです。もう一度教えてください。"]);
      return;
    }
    answersRef.current.birthDate = iso;
    answersRef.current.birthDateLabel = `${y}年${m}月${d}日`;
    push("user", `${y}年${m}月${d}日`);
    setStep("boot");
    if (editing) {
      setEditing(null);
      goConfirm();
      return;
    }
    say(
      [
        "ありがとうございます。",
        "次は、生まれた時刻を教えてください。母子手帳に載っていることが多いです。わからなくても大丈夫。",
      ],
      () => setStep("time"),
    );
  }, [dYear, dMonth, dDay, editing, push, say, goConfirm]);

  const handleTimeSubmit = useCallback(
    (unknown: boolean) => {
      answersRef.current.timeUnknown = unknown;
      if (!unknown) answersRef.current.birthTime = dockTime;
      push("user", unknown ? "時間はわからない" : dockTime);
      setStep("boot");
      const next = () => {
        if (editing) {
          setEditing(null);
          goConfirm();
          return;
        }
        say(
          ["最後に、生まれた場所を教えてください。都道府県だけでも大丈夫です。"],
          () => setStep("place"),
        );
      };
      if (unknown) {
        say(["わかりました。その場合は、お昼12時の空で読みますね。"], next);
      } else {
        next();
      }
    },
    [dockTime, editing, push, say, goConfirm],
  );

  const handlePlaceSubmit = useCallback(
    (skip: boolean) => {
      answersRef.current.prefecture = skip ? "" : dockPref;
      answersRef.current.city = skip ? "" : dockCity.trim();
      push(
        "user",
        skip
          ? "スキップする"
          : `${dockPref}${dockCity.trim() ? ` ${dockCity.trim()}` : ""}`,
      );
      setStep("boot");
      if (editing) setEditing(null);
      goConfirm();
    },
    [dockPref, dockCity, editing, push, goConfirm],
  );

  // 確認画面の「◯◯を直す」
  const handleEdit = useCallback(
    (target: Exclude<Editing, null>) => {
      setEditing(target);
      setStep("boot");
      const q = {
        date: "生まれた日を、もう一度教えてください。",
        time: "生まれた時刻を、もう一度教えてください。",
        place: "生まれた場所を、もう一度教えてください。",
      }[target];
      say([q], () => setStep(target));
    },
    [say],
  );

  const handleConfirm = useCallback(async () => {
    const a = answersRef.current;
    setStep("submitting");
    try {
      const res = await fetch("/api/birth-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birth_date: a.birthDate,
          birth_time: a.timeUnknown ? null : a.birthTime,
          time_unknown: a.timeUnknown,
          prefecture: a.prefecture || null,
          city: a.city || null,
          analytics_page: "unmei",
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        // 生のAPIエラー(英語)はユーザーに出さず、やさしい定型文にする
        say(["うまく保存できませんでした。もう一度お試しください。"], () =>
          setStep("confirm"),
        );
        void j;
        return;
      }
      track("birth_form_submit", {
        metadata: {
          has_time: !a.timeUnknown,
          has_place: !!a.prefecture,
          page: "unmei",
          ui: mode === "purchase" ? "chat_purchase" : "chat",
        },
      });
      if (mode === "purchase") {
        // 未購入: 保存できたので、次はチャット内で決済へ (onSaved はまだ呼ばない)。
        // 決済フォーム到達は checkout_session_created(payment_method=card_embedded・サーバ発行)
        // で計上するため、ここでの追加計測イベントは持たない (RLS 未許可の空撃ちだった)。
        say(
          [
            "ありがとうございます。準備ができました。",
            "最後に、お支払いへ進みます。決済が終わると、その場で星を読みはじめます。",
          ],
          () => setStep("payment"),
        );
        return;
      }
      say(["受け取りました。それでは——星を読みはじめますね。"], onSaved);
    } catch {
      say(["ネットワークエラーが起きました。もう一度試してみてください。"], () =>
        setStep("confirm"),
      );
    }
  }, [say, onSaved, mode]);

  // purchase モード: 決済完了 → 生成へ (親が waiting=true を渡してくる)
  const handlePaymentComplete = useCallback(() => {
    setStep("boot");
    say(["お支払いを受け取りました。それでは——星を読みはじめますね。"], onSaved);
  }, [say, onSaved]);

  // ---- 描画 ----

  const maxDay =
    dYear && dMonth ? daysInMonth(Number(dYear), Number(dMonth)) : 31;

  // 入力カード (会話内) を出せる状態か (案内人の発言中・生成待ち中は出さない)
  const interactive = !waiting && !typing;

  const selectCls =
    "min-w-0 rounded-xl border border-[#D9D9EC] bg-[#F7F7FB] px-2 py-2.5 text-[15px] font-bold text-[#2E2E5C]";
  // 会話内のユーザー側入力カード (回答がそのまま吹き出しになるイメージで右寄せ)
  const cardCls =
    "w-full max-w-[320px] rounded-2xl rounded-br-[4px] border border-[#E9E9F2] bg-white p-3 shadow-[0_1px_2px_rgba(46,46,92,0.06)]";

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pb-10 pt-5 md:px-8 md:pb-14 md:pt-8">
      <h1 className="sr-only">あなたの設計図を描くために</h1>

      {/* チャットウィンドウ (紺ヘッダー + トーク面の1枚パネル) */}
      <div className="flex h-[76dvh] min-h-[440px] flex-col overflow-hidden rounded-2xl border border-[#E9E9F2] bg-white shadow-[0_6px_24px_rgba(46,46,92,0.10)] md:h-[620px]">
        {/* ヘッダーバー */}
        <div className="flex items-center gap-3 bg-[#2E2E5C] px-4 py-3">
          <SmoothImage
            src="/mascot/unmei-guide.webp"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 flex-shrink-0 rounded-full ring-2 ring-white/25"
          />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-black leading-tight text-white">
              {GUIDE_NAME}
            </p>
            <p className="text-[11px] font-bold leading-tight text-white/55">
              運命の設計図
            </p>
          </div>
          {/* 右端の星 (ヘッダーの世界観装飾。読み上げ不要) */}
          <span
            aria-hidden="true"
            className="ml-auto text-[16px] leading-none text-[#F5D66B]"
          >
            ✦<span className="ml-1 text-[10px] align-top text-[#F5D66B]/60">✦</span>
          </span>
        </div>

        {/* トーク面 (内部スクロール)。入力カードも会話の一部としてここに出す */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#F3F3FB] px-3 py-4">
          <div className="flex flex-col gap-2.5">
            {messages.map((m, i) => {
              const isGuide = m.role === "guide";
              const firstOfGroup = i === 0 || messages[i - 1].role !== m.role;
              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-2 ${isGuide ? "" : "justify-end"}`}
                >
                  {isGuide ? (
                    firstOfGroup ? (
                      <SmoothImage
                        src="/mascot/unmei-guide.webp"
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 flex-shrink-0 rounded-full border border-[#E9E9F2] bg-white"
                      />
                    ) : (
                      <div aria-hidden="true" className="w-8 flex-shrink-0" />
                    )
                  ) : null}
                  <p
                    className={
                      isGuide
                        ? "max-w-[80%] whitespace-pre-line rounded-2xl rounded-bl-[4px] bg-white px-4 py-2.5 text-[15px] font-bold leading-relaxed text-[#2E2E5C] shadow-[0_1px_2px_rgba(46,46,92,0.06)]"
                        : "max-w-[80%] whitespace-pre-line rounded-2xl rounded-br-[4px] bg-[#5B5BEF] px-4 py-2.5 text-[15px] font-bold leading-relaxed text-white shadow-[0_1px_2px_rgba(46,46,92,0.10)]"
                    }
                  >
                    {m.text}
                  </p>
                </div>
              );
            })}

            {/* タイピング中 / 生成待ちのインジケーター */}
            {(typing || waiting) && (
              <div className="flex items-end gap-2">
                <SmoothImage
                  src="/mascot/unmei-guide.webp"
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 flex-shrink-0 rounded-full border border-[#E9E9F2] bg-white"
                />
                <div className="rounded-2xl rounded-bl-[4px] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(46,46,92,0.06)]">
                  <span className="flex gap-1.5" aria-label="入力中">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-2 w-2 animate-bounce rounded-full bg-[#5B5BEF]/50"
                        style={{ animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
            {waiting && (
              <p className="ml-10 text-[12px] font-bold leading-relaxed text-[#8A8AA3]">
                あなたが生まれた瞬間の空を再現しています。1分ほどかかることがあります。
              </p>
            )}

            {/* ---- 入力カード (会話内・ユーザー側) ---- */}

            {interactive && step === "date" && (
              <div className="flex justify-end">
                <div className={cardCls}>
                  <div className="flex gap-2">
                    <select
                      aria-label="年"
                      value={dYear}
                      onChange={(e) => setDYear(e.target.value)}
                      className={`${selectCls} flex-[1.35]`}
                    >
                      <option value="">年</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}年
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="月"
                      value={dMonth}
                      onChange={(e) => setDMonth(e.target.value)}
                      className={`${selectCls} flex-1`}
                    >
                      <option value="">月</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {m}月
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="日"
                      value={dDay}
                      onChange={(e) => setDDay(e.target.value)}
                      className={`${selectCls} flex-1`}
                    >
                      <option value="">日</option>
                      {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}日
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2.5 flex justify-end">
                    <SendButton
                      onClick={handleDateSubmit}
                      disabled={!dYear || !dMonth || !dDay || Number(dDay) > maxDay}
                    />
                  </div>
                </div>
              </div>
            )}

            {interactive && step === "time" && (
              <>
                <div className="flex flex-wrap justify-end gap-2">
                  <Chip onClick={() => handleTimeSubmit(true)}>
                    わからない（正午で計算）
                  </Chip>
                </div>
                <div className="flex justify-end">
                  <div className={cardCls}>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        aria-label="出生時刻"
                        value={dockTime}
                        onChange={(e) => setDockTime(e.target.value)}
                        className="min-w-0 flex-1 rounded-xl border border-[#D9D9EC] bg-[#F7F7FB] px-3 py-2.5 text-[15px] font-bold text-[#2E2E5C]"
                      />
                      <SendButton onClick={() => handleTimeSubmit(false)} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {interactive && step === "place" && (
              <>
                <div className="flex flex-wrap justify-end gap-2">
                  <Chip onClick={() => handlePlaceSubmit(true)}>スキップする</Chip>
                </div>
                <div className="flex justify-end">
                  <div className={cardCls}>
                    <select
                      aria-label="都道府県"
                      value={dockPref}
                      onChange={(e) => setDockPref(e.target.value)}
                      className={`${selectCls} w-full`}
                    >
                      <option value="">都道府県を選択</option>
                      {PREFS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="市区町村（任意）"
                        value={dockCity}
                        onChange={(e) => setDockCity(e.target.value)}
                        className="min-w-0 flex-1 rounded-xl border border-[#D9D9EC] bg-[#F7F7FB] px-3 py-2.5 text-[15px] font-bold text-[#2E2E5C]"
                      />
                      <SendButton
                        onClick={() => handlePlaceSubmit(false)}
                        disabled={!dockPref}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {interactive && (step === "confirm" || step === "submitting") && (
              <div className="flex justify-end">
                {/* 修正チップとCTAを他ステップと同じ入力カードに収め、1つの塊にする
                    (バラ置きだと広い画面で CTA が宙に浮く / 2026-08-05 指示) */}
                <div className={cardCls}>
                  {step === "confirm" && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      <Chip onClick={() => handleEdit("date")}>生年月日を直す</Chip>
                      <Chip onClick={() => handleEdit("time")}>出生時刻を直す</Chip>
                      <Chip onClick={() => handleEdit("place")}>出生地を直す</Chip>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={step === "submitting"}
                    className="w-full rounded-full bg-[#5B5BEF] py-3 font-bold text-white disabled:opacity-40"
                  >
                    {step === "submitting"
                      ? "送信中…"
                      : mode === "purchase"
                        ? "このまま進む"
                        : "この内容で描いてもらう"}
                  </button>
                </div>
              </div>
            )}

            {/* purchase モード: チャット内の Embedded Checkout (決済) */}
            {interactive && step === "payment" && (
              <div className="flex justify-end">
                <div className="w-full max-w-[440px]">
                  <UnmeiEmbeddedCheckout
                    product={product}
                    ownerToken={ownerToken}
                    onComplete={handlePaymentComplete}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </main>
  );
}
