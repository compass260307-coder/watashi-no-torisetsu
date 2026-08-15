"use client";

// Stripe-hosted Checkout から /unmei?checkout=success に戻った後の受け皿。
// Webhookによる購入反映と鑑定生成をポーリングし、チャットの会話を続ける形で待たせる。
// 鑑定が完成したらクエリを外した /unmei に戻し、完成した鑑定書を表示する。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SmoothImage } from "@/components/ui/SmoothImage";
import type { ResultLocale } from "@/i18n/result";

type Phase = "confirming" | "generating" | "failed" | "timeout";

const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS = 3 * 60_000;

export default function UnmeiCheckoutConfirming({
  preview = false,
  locale = "ja",
}: {
  preview?: boolean;
  locale?: ResultLocale;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(preview ? "generating" : "confirming");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (preview) return;

    const deadline = Date.now() + TIMEOUT_MS;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let generationKicked = false;

    async function kickGeneration(force: boolean) {
      try {
        await fetch("/api/unmei/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        });
      } catch {
        // status の次回ポーリングで回復できるため、ここでは待機を続ける。
      }
    }

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/unmei/status", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { state?: string };
          if (cancelled) return;

          if (data.state === "ready") {
            router.replace(locale === "ko" ? "/ko/unmei" : "/unmei");
            return;
          }
          if (data.state === "no_birth") {
            // 通常は決済前に保存済み。万一未保存なら入力画面へ安全に戻す。
            router.replace(locale === "ko" ? "/ko/unmei" : "/unmei");
            return;
          }
          if (data.state === "failed") {
            setPhase("failed");
            return;
          }
          if (data.state === "pending") {
            setPhase("generating");
            if (!generationKicked) {
              generationKicked = true;
              void kickGeneration(retryKey > 0);
            }
          } else {
            setPhase("confirming");
          }
        }
      } catch {
        // 一時的なネットワークエラーは次のポーリングで回復する。
      }

      if (Date.now() >= deadline) {
        setPhase("timeout");
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [locale, preview, retryKey, router]);

  const isKo = locale === "ko";
  const waitingCopy = isKo
    ? "결제가 완료됐어요. 설계도를 만들고 있어요."
    : "購入が完了しました。鑑定書を作成しています。";

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pb-10 pt-5 md:px-8 md:pb-14 md:pt-8">
      <h1 className="sr-only">
        {isKo ? "운명의 설계도를 만들고 있어요" : "運命の設計図を作成しています"}
      </h1>
      <div className="flex h-[76dvh] min-h-[440px] flex-col overflow-hidden rounded-2xl border border-[#E9E9F2] bg-white shadow-[0_6px_24px_rgba(46,46,92,0.10)] md:h-[620px]">
        <div className="flex items-center gap-3 bg-[#2E2E5C] px-4 py-3">
          <SmoothImage
            src="/mascot/unmei-guide.webp"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full ring-2 ring-white/25"
          />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-black leading-tight text-white">
              {isKo ? "별자리 안내자" : "星読みの案内人"}
            </p>
            <p className="text-[11px] font-bold leading-tight text-white/55">
              {isKo ? "운명의 설계도" : "運命の設計図"}
            </p>
          </div>
          <span aria-hidden="true" className="ml-auto text-[16px] leading-none text-[#F5D66B]">
            ✦<span className="ml-1 text-[10px] align-top text-[#F5D66B]/60">✦</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F3F3FB] px-3 py-4">
          <div className="flex items-end gap-2">
            <SmoothImage
              src="/mascot/unmei-guide.webp"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full border border-[#E9E9F2] bg-white"
            />
            <div className="max-w-[78%] rounded-2xl rounded-bl-[4px] bg-white px-4 py-3 text-[14px] font-bold leading-relaxed text-[#2E2E5C] shadow-[0_1px_2px_rgba(46,46,92,0.06)]">
              {phase === "failed" ? (
                <>
                  {isKo
                    ? "설계도를 만드는 중에 작업이 멈췄어요."
                    : "鑑定書の作成が途中で止まってしまいました。"}
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("generating");
                      setRetryKey((key) => key + 1);
                    }}
                    className="mt-3 block rounded-full bg-[#5B5BEF] px-5 py-2.5 text-[13px] font-black text-white"
                  >
                    {isKo ? "다시 만들기" : "もう一度作成する"}
                  </button>
                </>
              ) : phase === "timeout" ? (
                <>
                  {isKo
                    ? "설계도를 만드는 데 시간이 조금 걸리고 있어요. 화면을 닫아도 완성된 뒤 다시 확인할 수 있어요."
                    : "鑑定書の作成に少し時間がかかっています。画面を閉じても、完成後にまた確認できます。"}
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("generating");
                      setRetryKey((key) => key + 1);
                    }}
                    className="mt-3 block rounded-full bg-[#5B5BEF] px-5 py-2.5 text-[13px] font-black text-white"
                  >
                    {isKo ? "진행 상황 다시 확인하기" : "作成状況をもう一度確認する"}
                  </button>
                </>
              ) : (
                <>
                  {waitingCopy}
                  <span
                    className="mt-2 flex items-center gap-1"
                    aria-label={isKo ? "만드는 중" : "作成中"}
                  >
                    {[0, 1, 2].map((index) => (
                      <span
                        key={index}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8A8AA3]"
                        style={{ animationDelay: `${index * 120}ms` }}
                      />
                    ))}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
