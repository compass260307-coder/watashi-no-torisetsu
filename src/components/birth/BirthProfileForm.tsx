"use client";

import React, { useEffect, useState } from "react";
import { track } from "@/lib/track";

type Props = {
  onSaved?: () => void;
  onSkipped?: () => void;
  initial?: {
    birth_date?: string;
    birth_time?: string | null;
    time_unknown?: boolean;
    prefecture?: string | null;
    city?: string | null;
  };
  required?: boolean; // 生年月日を必須にする (¥1,980 purchase)
};

const PREFS = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
];

export function BirthProfileForm({ onSaved, onSkipped, initial, required }: Props) {
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? "");
  const [timeUnknown, setTimeUnknown] = useState(initial?.time_unknown ?? false);
  const [birthTime, setBirthTime] = useState(initial?.birth_time ?? "12:00");
  const [prefecture, setPrefecture] = useState(initial?.prefecture ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("birth_form_view");
  }, []);

  function validate() {
    if (required && !birthDate) return "生年月日を入力してください";
    if (birthDate) {
      const d = new Date(birthDate);
      const now = new Date();
      if (d > now) return "未来日は指定できません";
      if (now.getFullYear() - d.getFullYear() > 120) return "120年以上前は指定できません";
    }
    return null;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/birth-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birth_date: birthDate,
          birth_time: timeUnknown ? null : birthTime,
          time_unknown: timeUnknown,
          prefecture: prefecture || null,
          city: city || null,
          // for simplicity, latitude/longitude resolved server-side later
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error ?? "保存に失敗しました");
        setSubmitting(false);
        return;
      }
      track("birth_form_submit", { metadata: { has_time: !timeUnknown, has_place: !!prefecture } });
      onSaved?.();
    } catch (err) {
      setError("ネットワークエラー");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    track("birth_form_skip");
    onSkipped?.();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[640px]">
      <div className="mb-3">
        <label className="block text-sm font-bold">生年月日{required ? "（必須）" : "（任意）"}</label>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="mt-2 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-bold">出生時刻（任意）</label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="time"
            value={birthTime ?? "12:00"}
            onChange={(e) => setBirthTime(e.target.value)}
            disabled={timeUnknown}
            className="rounded-md border px-3 py-2"
          />
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} />
            わからない（正午で計算します）
          </label>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-bold">出生地（任意）</label>
        <div className="mt-2 flex gap-3">
          <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} className="rounded-md border px-3 py-2">
            <option value="">都道府県を選択</option>
            {PREFS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="市区町村（任意）"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2"
          />
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="rounded-full bg-[#5B5BEF] px-5 py-2 font-bold text-white">
          {submitting ? "保存中…" : "保存する"}
        </button>
        <button type="button" onClick={handleSkip} disabled={submitting} className="rounded-full border px-4 py-2">
          あとで入力する
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        出生データは、あなたのホロスコープの計算のみに使用します。入力は任意で、設定からいつでも削除できます。
      </p>
    </form>
  );
}

export default BirthProfileForm;
