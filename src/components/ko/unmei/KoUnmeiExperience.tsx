"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";

type ReadingSection = {
  id?: string;
  title?: string;
  subline?: string;
  body?: string;
};

export type KoUnmeiReading = {
  locale?: string;
  hitokoto?: string;
  sections?: ReadingSection[];
};

type ExperienceState = "no_birth" | "pending" | "failed" | "ready";

const KOREAN_LOCATIONS = [
  { value: "", label: "선택하지 않음 (서울 기준)", lat: null, lng: null },
  { value: "서울특별시", label: "서울특별시", lat: 37.5665, lng: 126.978 },
  { value: "부산광역시", label: "부산광역시", lat: 35.1796, lng: 129.0756 },
  { value: "대구광역시", label: "대구광역시", lat: 35.8714, lng: 128.6014 },
  { value: "인천광역시", label: "인천광역시", lat: 37.4563, lng: 126.7052 },
  { value: "광주광역시", label: "광주광역시", lat: 35.1595, lng: 126.8526 },
  { value: "대전광역시", label: "대전광역시", lat: 36.3504, lng: 127.3845 },
  { value: "울산광역시", label: "울산광역시", lat: 35.5384, lng: 129.3114 },
  { value: "세종특별자치시", label: "세종특별자치시", lat: 36.48, lng: 127.289 },
  { value: "제주특별자치도", label: "제주특별자치도", lat: 33.4996, lng: 126.5312 },
] as const;

function normalizeReading(payload: unknown): KoUnmeiReading | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as { reading?: unknown };
  const reading = row.reading;
  if (!reading || typeof reading !== "object") return null;
  const value = reading as KoUnmeiReading;
  return Array.isArray(value.sections) ? value : null;
}

function paragraphs(value: string | undefined): string[] {
  return (value ?? "")
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function KoUnmeiExperience({
  ownerToken,
  initialState,
  initialReading,
}: {
  ownerToken: string;
  initialState: ExperienceState;
  initialReading?: KoUnmeiReading | null;
}) {
  const [state, setState] = useState<ExperienceState>(initialState);
  const [reading, setReading] = useState<KoUnmeiReading | null>(
    initialReading ?? null,
  );
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("12:00");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const forceNextGenerationRef = useRef(false);

  const saveKoreanPreference = useCallback(async () => {
    if (!ownerToken) return;
    await fetch("/api/account/preferred-locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerToken, locale: "ko" }),
    });
  }, [ownerToken]);

  const startGeneration = useCallback(
    async (force = false): Promise<boolean> => {
      try {
        await saveKoreanPreference();
        const response = await fetch("/api/unmei/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        });
        if (!response.ok) throw new Error("generate failed");
        return true;
      } catch {
        setState("failed");
        setError("설계도 생성을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        return false;
      }
    },
    [saveKoreanPreference],
  );

  useEffect(() => {
    if (state !== "pending") return;
    let cancelled = false;
    let timer = 0;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch("/api/unmei/status", { cache: "no-store" });
        if (!response.ok) throw new Error("status failed");
        const payload = (await response.json()) as {
          state?: string;
          reading?: unknown;
        };
        if (cancelled) return;
        if (payload.state === "ready") {
          const next = normalizeReading(payload.reading);
          if (next?.locale === "ko") {
            setReading(next);
            setState("ready");
            track("unmei_reading_view", {
              ownerToken,
              metadata: { locale: "ko", state: "ready" },
            });
            return;
          }
        }
        if (payload.state === "failed" || attempts >= 50) {
          setState("failed");
          setError("생성에 시간이 걸리고 있어요. 다시 시도하면 이어서 만들 수 있어요.");
          return;
        }
      } catch {
        if (attempts >= 20) {
          setState("failed");
          setError("연결 상태를 확인한 뒤 다시 시도해 주세요.");
          return;
        }
      }
      timer = window.setTimeout(poll, 3000);
    };

    const force = forceNextGenerationRef.current;
    forceNextGenerationRef.current = false;
    void startGeneration(force).then((started) => {
      if (!cancelled && started) void poll();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ownerToken, startGeneration, state]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!birthDate || saving) return;
    setSaving(true);
    setError(null);
    const selected = KOREAN_LOCATIONS.find((item) => item.value === location);
    try {
      await saveKoreanPreference();
      const response = await fetch("/api/birth-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birth_date: birthDate,
          birth_time: timeUnknown ? null : birthTime,
          time_unknown: timeUnknown,
          prefecture: selected?.value || null,
          city: null,
          latitude: selected?.lat ?? null,
          longitude: selected?.lng ?? null,
          place_unknown: !selected?.value,
          analytics_page: "unmei",
        }),
      });
      if (!response.ok) throw new Error("save failed");
      track("birth_form_submit", {
        ownerToken,
        metadata: {
          locale: "ko",
          has_time: !timeUnknown,
          has_place: Boolean(selected?.value),
          page: "unmei",
        },
      });
      setState("pending");
    } catch {
      setError("출생 정보를 저장하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  if (state === "ready" && reading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#17172E] px-5 py-16 text-white sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(91,91,239,0.34),transparent_55%)]" />
        <div className="relative mx-auto max-w-[760px]">
          <p className="text-center text-sm font-extrabold tracking-[0.22em] text-[#F5D66B]">
            운명의 설계도
          </p>
          <h1 className="mt-4 text-center text-3xl font-black leading-tight sm:text-5xl">
            태어난 순간의 하늘과<br />성격 진단이 만나는 이야기
          </h1>
          {reading.hitokoto ? (
            <p className="mx-auto mt-8 max-w-[620px] text-center text-lg font-bold leading-8 text-white/80">
              {reading.hitokoto}
            </p>
          ) : null}

          <div className="mt-16 space-y-10">
            {(reading.sections ?? []).map((section, index) => (
              <section
                key={section.id ?? index}
                className="rounded-[28px] border border-white/15 bg-white/[0.07] p-6 shadow-2xl backdrop-blur sm:p-9"
              >
                <p className="text-xs font-black tracking-[0.2em] text-[#F5D66B]">
                  CHAPTER {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 text-2xl font-black leading-snug">
                  {section.title}
                </h2>
                {section.subline ? (
                  <p className="mt-3 font-bold leading-7 text-[#B8B9FF]">
                    {section.subline}
                  </p>
                ) : null}
                <div className="mt-6 space-y-5 text-[16px] leading-8 text-white/85">
                  {paragraphs(section.body).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mx-auto mt-14 max-w-[620px] text-center text-sm leading-7 text-white/60">
            이 결과는 오락과 자기 이해를 위한 참고 정보이며, 의학적·심리학적 진단이나
            미래에 대한 확정적 예측이 아닙니다.
          </p>
        </div>
      </main>
    );
  }

  if (state === "pending") {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#17172E] px-6 text-center text-white">
        <div className="max-w-[520px]">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-[#F5D66B]" />
          <h1 className="mt-8 text-2xl font-black">당신의 하늘을 읽고 있어요</h1>
          <p className="mt-3 leading-7 text-white/65">
            성격 진단과 출생 순간의 별을 함께 읽어 한국어 설계도를 만들고 있어요.
            보통 1~2분 정도 걸립니다.
          </p>
        </div>
      </main>
    );
  }

  if (state === "failed") {
    return (
      <main className="flex min-h-[65vh] items-center justify-center bg-[#F7F7FC] px-6 text-center">
        <div className="max-w-[520px] rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-black text-[#2E2E5C]">생성을 이어갈 수 있어요</h1>
          <p className="mt-3 leading-7 text-[#666980]">{error}</p>
          <button
            type="button"
            onClick={() => {
              forceNextGenerationRef.current = true;
              setError(null);
              setState("pending");
            }}
            className="mt-7 w-full rounded-full bg-[#2E2E5C] px-6 py-4 font-black text-white"
          >
            다시 생성하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#F7F7FC] px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-[680px] rounded-[30px] border border-[#E1E2EF] bg-white p-6 shadow-xl sm:p-10">
        <p className="text-sm font-black tracking-[0.15em] text-[#5B5BEF]">운명의 설계도</p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-[#2E2E5C]">
          태어난 순간의 정보를<br />알려 주세요
        </h1>
        <p className="mt-4 leading-7 text-[#666980]">
          출생 시간과 장소를 알면 더 정확한 하늘을 계산할 수 있어요. 모르는 항목은
          건너뛰어도 됩니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <label className="block">
            <span className="text-sm font-black text-[#2E2E5C]">생년월일</span>
            <input
              type="date"
              required
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#DADCEA] px-4 py-3.5 text-[#2E2E5C]"
            />
          </label>

          <div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-black text-[#2E2E5C]">출생 시간</span>
              <label className="flex items-center gap-2 text-sm font-bold text-[#666980]">
                <input
                  type="checkbox"
                  checked={timeUnknown}
                  onChange={(event) => setTimeUnknown(event.target.checked)}
                />
                시간을 몰라요
              </label>
            </div>
            <input
              type="time"
              value={birthTime}
              disabled={timeUnknown}
              onChange={(event) => setBirthTime(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#DADCEA] px-4 py-3.5 text-[#2E2E5C] disabled:bg-[#F0F1F6]"
            />
          </div>

          <label className="block">
            <span className="text-sm font-black text-[#2E2E5C]">출생 지역</span>
            <select
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#DADCEA] bg-white px-4 py-3.5 text-[#2E2E5C]"
            >
              {KOREAN_LOCATIONS.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {error ? <p className="text-sm font-bold text-[#D94B52]">{error}</p> : null}
          <button
            type="submit"
            disabled={saving || !birthDate}
            className="w-full rounded-full bg-[#2E2E5C] px-6 py-4 text-lg font-black text-white shadow-[0_4px_0_#17172E] disabled:opacity-50"
          >
            {saving ? "저장하고 있어요…" : "내 설계도 만들기"}
          </button>
        </form>
      </div>
    </main>
  );
}
