"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./UnmeiGenerating.module.css";

const SCENE_IMAGES = ["looking", "reading", "writing"] as const;

// 生成待ちの文言。日本語と韓国語は同じ演出で、文だけ切り替える。
const COPY = {
  ja: {
    scenes: [
      { alt: "窓の星を見上げて考えるAlice", lines: ["あなたが生まれた日の星を、", "ひとつずつ読んでいるよ。"] },
      { alt: "星の本を開いて読み解くAlice", lines: ["星の本も開いて、", "じっくり読んでみるね。"] },
      { alt: "星の本を見ながらノートに書き留めるAlice", lines: ["読み取ったことを、", "あなたへの言葉にしているよ。"] },
    ],
    readyLines: ["あなたの設計図ができたよ。", "一緒に見てみよう。"],
    ariaReady: "運命の設計図が完成",
    ariaPending: "運命の設計図を作成中",
    viewResult: "結果を見る",
    reading: "Aliceが読み解き中",
  },
  ko: {
    scenes: [
      { alt: "창밖의 별을 올려다보며 생각하는 Alice", lines: ["당신이 태어난 날의 별을", "하나씩 읽고 있어요."] },
      { alt: "별의 책을 펼쳐 읽고 있는 Alice", lines: ["별의 책도 펼쳐서", "천천히 읽어 볼게요."] },
      { alt: "별의 책을 보며 노트에 적고 있는 Alice", lines: ["읽어 낸 이야기를", "당신에게 전할 말로 옮기고 있어요."] },
    ],
    readyLines: ["당신의 설계도가 완성됐어요.", "함께 살펴봐요."],
    ariaReady: "운명의 설계도 완성",
    ariaPending: "운명의 설계도 작성 중",
    viewResult: "결과 보기",
    reading: "Alice가 읽고 있어요",
  },
} as const;

export default function UnmeiGenerating({ ready = false, onViewResult, locale = "ja" }: { ready?: boolean; onViewResult?: () => void; locale?: "ja" | "ko" }) {
  const copy = COPY[locale];
  const scenes = SCENE_IMAGES.map((image, index) => ({ image, ...copy.scenes[index] }));
  const [tick, setTick] = useState(0);
  const sceneIndex = tick === 0 ? 0 : tick % 2 === 1 ? 1 : 2;
  const scene = scenes[sceneIndex];
  useEffect(() => {
    if (ready) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 8_000);
    return () => window.clearInterval(timer);
  }, [ready]);

  return (
    <section className={styles.room} aria-label={ready ? copy.ariaReady : copy.ariaPending} aria-busy={!ready}>
      {scenes.map((item, index) => (
        <Image key={item.image} src={`/mascot/unmei-alice-${item.image}-room-v1.webp`} alt={index === sceneIndex ? item.alt : ""} aria-hidden={index !== sceneIndex} fill loading="eager" priority={index === 0} sizes="(min-width: 640px) 640px, 100vw" className={styles.background} style={{ opacity: index === sceneIndex ? 1 : 0 }} />
      ))}
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.intro}>
        <p className={styles.name}>Alice</p>
        <h1>{ready ? <>{copy.readyLines[0]}<br />{copy.readyLines[1]}</> : <>{scene.lines[0]}<br />{scene.lines[1]}</>}</h1>
      </div>
      <div className={styles.stars} aria-hidden="true">
        <span>✦</span><span>✧</span><span>✦</span><span>✧</span>
      </div>
      <div className={styles.progress}>
        {ready ? <button type="button" className={styles.resultButton} onClick={onViewResult}><span aria-hidden="true">✦</span>{copy.viewResult}</button> : <div role="status">
        <div className={styles.seal} aria-hidden="true"><span>✦</span><i /></div>
        <p className={styles.label}>{copy.reading}<span className={styles.dots}>...</span></p>
        </div>}
      </div>
    </section>
  );
}
