"use client";

// 数値画面の配色 (白地・黒地)。既定は白地で、選んだ配色は端末に覚える。
// 「1日の数字」と「月の推移」の両方のページで同じものを使う。
import { useEffect, useState } from "react";

import { NUMBERS_THEMES, type NumbersThemeName } from "./numbers-ui";

const THEME_KEY = "wt_internal_numbers_theme";

export function useNumbersTheme(): {
  theme: NumbersThemeName;
  toggleTheme: () => void;
} {
  const [theme, setTheme] = useState<NumbersThemeName>("light");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // 端末の控えは描画後にしか読めない (サーバー側には無い) ので、ここで読む。
      await Promise.resolve();
      if (cancelled) return;
      try {
        if (window.localStorage.getItem(THEME_KEY) === "dark") {
          setTheme("dark");
        }
      } catch {
        // 読めない端末では、既定の白地のまま。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 画面の外側 (body) も同じ地の色にする。下部の余白に別の色の帯が出ないように。
  useEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = String(
      (NUMBERS_THEMES[theme] as Record<string, string>)["--nb-bg"],
    );
    return () => {
      document.body.style.background = previous;
    };
  }, [theme]);

  const toggleTheme = () => {
    const next: NumbersThemeName = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // 保存できない端末では、開き直すと既定に戻るだけ。
    }
  };

  return { theme, toggleTheme };
}
