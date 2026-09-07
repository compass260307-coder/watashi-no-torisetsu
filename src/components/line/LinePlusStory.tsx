"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import styles from "./LinePlusStory.module.css";

type LinePlusStoryProps = {
  freeLimit: number;
};

const scenes = [
  {
    label: "おしゃべり",
    number: "01",
    conversation: [
      {
        role: "user",
        text: "今日、友だちに「考えすぎ」って言われてさ。",
      },
      {
        role: "alice",
        text: "そっか。笑って流した？",
      },
      {
        role: "user",
        text: "うん。でも本当は、ちょっと傷ついた。",
      },
      {
        role: "alice",
        text: "軽く返したぶん、気持ちだけ置いていかれたんだね。",
      },
      {
        role: "user",
        text: "それかも。分かってほしかった。",
      },
      {
        role: "alice",
        text: "うん。否定せずに、まず聞いてほしかったんだよね。",
      },
    ],
  },
  {
    label: "深掘り占い",
    number: "02",
    conversation: [
      {
        role: "user",
        text: "この恋、どう動いたらいい？",
      },
      {
        role: "alice",
        text: "「もっと近づきたい」と「今の関係を壊したくない」の間で迷ってるんだね。",
      },
      {
        role: "user",
        text: "うん。本当はもっと近づきたい。でも、重いって思われるのが怖い。",
      },
      {
        role: "alice",
        text: "その本音が大事だね。「動くタイミング」と「相手に届きやすい伝え方」を、今のふたりの流れから見てみよう。",
      },
    ],
  },
  {
    label: "タロット",
    number: "03",
    conversation: [
      {
        role: "user",
        text: "明日の誘い、行くかまだ迷ってる。",
      },
      {
        role: "alice",
        text: "行ってみたい気持ちと、気疲れしそうな気持ちがあるんだね。その迷いを浮かべて、一枚選んでみて。",
      },
      {
        role: "user",
        text: "じゃあ、真ん中のカード。",
      },
      {
        role: "alice",
        text: "「星」だね。無理に長くいなくても大丈夫。短時間だけ顔を出す選び方が、明日のあなたには合いそう。",
      },
    ],
  },
] as const;

export default function LinePlusStory({ freeLimit }: LinePlusStoryProps) {
  const storyRef = useRef<HTMLDivElement>(null);
  const [activeScene, setActiveScene] = useState(0);
  // 通常環境ではSSRから同じ高さのsticky版を描画し、hydration時の大きなCLSを避ける。
  // reduced-motion / 短い画面はCSSでも即座に静的版へ切り替える。
  const [motionEnabled, setMotionEnabled] = useState(true);
  const safeFreeLimit = Math.max(0, Math.trunc(freeLimit));

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateMotionMode = () => {
      const canObserve = "IntersectionObserver" in window;
      const canStick =
        typeof window.CSS !== "undefined" &&
        window.CSS.supports("position", "sticky");
      const hasEnoughHeight = !window.matchMedia("(max-height: 600px)").matches;

      setMotionEnabled(
        !reduceMotion.matches && canObserve && canStick && hasEnoughHeight,
      );
    };

    updateMotionMode();
    reduceMotion.addEventListener?.("change", updateMotionMode);
    window.addEventListener("resize", updateMotionMode, { passive: true });

    return () => {
      reduceMotion.removeEventListener?.("change", updateMotionMode);
      window.removeEventListener("resize", updateMotionMode);
    };
  }, []);

  useEffect(() => {
    if (!motionEnabled) return;

    const root = storyRef.current;
    if (!root) return;

    const steps = root.querySelectorAll<HTMLElement>("[data-story-step]");
    const observer = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!current) return;

        const nextScene = Number(
          (current.target as HTMLElement).dataset.storyStep,
        );
        if (Number.isInteger(nextScene)) setActiveScene(nextScene);
      },
      {
        rootMargin: "-43% 0px -43% 0px",
        threshold: [0, 0.01],
      },
    );

    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, [motionEnabled]);

  return (
    <section
      data-plus-sticky-stop
      className={styles.section}
      aria-label="Alice Plusの利用イメージ"
    >
      <div
        ref={storyRef}
        className={styles.story}
        data-motion={motionEnabled ? "enhanced" : "static"}
        data-scene={activeScene}
      >
        <ol className={styles.staticList} aria-label="Alice Plusでできること">
          {scenes.map((scene, index) => (
            <li key={scene.label} className={styles.staticCard}>
              {index === 0 ? (
                <div className={styles.staticArtwork}>
                  <Image
                    src="/line/plus-promo.webp"
                    alt="星空の中で水晶玉を手にするAlice"
                    fill
                    sizes="(max-width: 767px) 100vw, 720px"
                    className={styles.staticImage}
                  />
                </div>
              ) : null}
              <p className={styles.staticLabel}>
                <span>{scene.number}</span>
                {scene.label}
              </p>
              <div className={styles.staticConversation}>
                {scene.conversation.map((message, messageIndex) => (
                  <p
                    key={`${message.role}-${messageIndex}`}
                    className={
                      message.role === "user"
                        ? styles.userBubble
                        : styles.aliceBubble
                    }
                  >
                    {message.role === "alice" ? <span>Alice</span> : null}
                    {message.text}
                  </p>
                ))}
              </div>
              {index === 0 ? (
                <p className={styles.limitNote}>
                  {`無料プランは1日${safeFreeLimit}通まで。Plusなら、無料枠を超えてたっぷり話せます。`}
                </p>
              ) : null}
            </li>
          ))}
        </ol>

        <div className={styles.motionTrack} aria-hidden="true">
          <div className={styles.stickyStage}>
            <div className={styles.canvas}>
              <Image
                src="/line/plus-promo.webp"
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 1040px"
                className={styles.stageImage}
              />
              <div className={styles.imageWash} />
              <div className={styles.aurora} />
              <div className={styles.stardust} />

              {scenes.map((scene, index) => (
                <article
                  key={scene.label}
                  className={styles.scene}
                  data-current={activeScene === index ? "true" : "false"}
                >
                  <div className={styles.sceneCopy}>
                    <p className={styles.sceneLabel}>
                      <span>{scene.number}</span>
                      {scene.label}
                    </p>
                  </div>

                  <div className={styles.conversation}>
                    {scene.conversation.map((message, messageIndex) => (
                      <p
                        key={`${message.role}-${messageIndex}`}
                        className={
                          message.role === "user"
                            ? styles.motionUserBubble
                            : styles.motionAliceBubble
                        }
                      >
                        {message.role === "alice" ? <span>Alice</span> : null}
                        {message.text}
                      </p>
                    ))}
                  </div>
                </article>
              ))}

              <p className={styles.scrollHint}>
                <span />
                SCROLL
              </p>
            </div>
          </div>

          <div className={styles.stepTrack}>
            {scenes.map((scene, index) => (
              <div
                key={scene.label}
                className={styles.step}
                data-story-step={index}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
