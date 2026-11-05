"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./UnmeiGenerating.module.css";

const scenes = [
  { image: "looking", alt: "窓の星を見上げて考えるAlice", lines: ["あなたが生まれた日の星を、", "ひとつずつ読んでいるよ。"] },
  { image: "reading", alt: "星の本を開いて読み解くAlice", lines: ["星の本も開いて、", "じっくり読んでみるね。"] },
  { image: "writing", alt: "星の本を見ながらノートに書き留めるAlice", lines: ["読み取ったことを、", "あなたへの言葉にしているよ。"] },
] as const;

export default function UnmeiGenerating({ ready = false, onViewResult }: { ready?: boolean; onViewResult?: () => void }) {
  const [tick, setTick] = useState(0);
  const sceneIndex = tick === 0 ? 0 : tick % 2 === 1 ? 1 : 2;
  const scene = scenes[sceneIndex];
  useEffect(() => {
    if (ready) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 8_000);
    return () => window.clearInterval(timer);
  }, [ready]);

  return (
    <section className={styles.room} aria-label={ready ? "運命の設計図が完成" : "運命の設計図を作成中"} aria-busy={!ready}>
      {scenes.map((item, index) => (
        <Image key={item.image} src={`/mascot/unmei-alice-${item.image}-room-v1.webp`} alt={index === sceneIndex ? item.alt : ""} aria-hidden={index !== sceneIndex} fill loading="eager" priority={index === 0} sizes="(min-width: 640px) 640px, 100vw" className={styles.background} style={{ opacity: index === sceneIndex ? 1 : 0 }} />
      ))}
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.intro}>
        <p className={styles.name}>Alice</p>
        <h1>{ready ? <>あなたの設計図ができたよ。<br />一緒に見てみよう。</> : <>{scene.lines[0]}<br />{scene.lines[1]}</>}</h1>
      </div>
      <div className={styles.stars} aria-hidden="true">
        <span>✦</span><span>✧</span><span>✦</span><span>✧</span>
      </div>
      <div className={styles.progress}>
        {ready ? <button type="button" className={styles.resultButton} onClick={onViewResult}><span aria-hidden="true">✦</span>結果を見る</button> : <div role="status">
        <div className={styles.seal} aria-hidden="true"><span>✦</span><i /></div>
        <p className={styles.label}>Aliceが読み解き中<span className={styles.dots}>…</span></p>
        </div>}
      </div>
    </section>
  );
}
