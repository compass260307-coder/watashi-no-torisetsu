"use client";

// Phase 3-β D-10: 通知設定タブ (5 カテゴリ ON/OFF)
//
// 楽観的更新: トグル即座に UI 反映 → 非同期で POST、失敗時はロールバック + エラー表示
// 失敗時の挙動: 一時的に元の値に戻し、ユーザーに「保存に失敗しました」を一行表示

import { useEffect, useRef, useState } from "react";

type Prefs = {
  enable_welcome: boolean;
  enable_diagnosis_complete: boolean;
  enable_friend_perception: boolean;
  enable_reminder: boolean;
  enable_broadcast: boolean;
};

const PREF_META: Array<{
  key: keyof Prefs;
  icon: string;
  label: string;
  desc: string;
}> = [
  {
    key: "enable_welcome",
    icon: "🎴",
    label: "ようこそメッセージ",
    desc: "新規 follow / 再 follow 時の welcome 通知",
  },
  {
    key: "enable_diagnosis_complete",
    icon: "✨",
    label: "診断完了通知",
    desc: "自己診断完了時のお知らせ",
  },
  {
    key: "enable_friend_perception",
    icon: "💌",
    label: "友達評価到着通知",
    desc: "友達があなたを評価したときの通知",
  },
  {
    key: "enable_reminder",
    icon: "💭",
    label: "リマインド",
    desc: "友達評価が来てないときの再招待提案",
  },
  {
    key: "enable_broadcast",
    icon: "📢",
    label: "お知らせ・キャンペーン",
    desc: "運営からの一斉配信",
  },
];

interface Props {
  idToken: string;
}

export function NotificationSettings({ idToken }: Props) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        const res = await fetch("/api/settings/notifications", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          setError(`設定の取得に失敗しました (${res.status})`);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as Prefs;
        setPrefs(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    })();
  }, [idToken]);

  const handleToggle = async (key: keyof Prefs) => {
    if (!prefs || savingKey) return;
    const next: Prefs = { ...prefs, [key]: !prefs[key] };
    // 楽観的更新
    setPrefs(next);
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) {
        // ロールバック
        setPrefs(prefs);
        setError("保存に失敗しました");
      }
    } catch {
      setPrefs(prefs);
      setError("通信エラーが発生しました");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-muted text-center py-10">読み込み中...</p>
    );
  }
  if (!prefs) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-foreground mb-2">設定を取得できませんでした</p>
        {error && <p className="text-xs text-muted">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted leading-relaxed mb-2">
        各カテゴリの通知を ON / OFF できます。
      </p>

      {PREF_META.map((m) => {
        const checked = prefs[m.key];
        const isSaving = savingKey === m.key;
        return (
          <label
            key={m.key}
            className={`flex items-start gap-3 rounded-2xl border border-card-border bg-card-bg p-4 cursor-pointer ${
              isSaving ? "opacity-60" : ""
            }`}
          >
            <div className="text-xl shrink-0">{m.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{m.label}</p>
              <p className="text-[11px] text-muted leading-relaxed mt-0.5">
                {m.desc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle(m.key)}
              role="switch"
              aria-checked={checked}
              disabled={isSaving}
              className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${
                checked ? "bg-primary" : "bg-card-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                  checked ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        );
      })}

      {error && (
        <p className="text-xs text-red-500 text-center mt-2">{error}</p>
      )}

      <p className="text-[11px] text-muted leading-relaxed mt-4 text-center">
        ※ LINE bot を unfollow すると、すべての通知が自動で OFF になります
      </p>
    </div>
  );
}
