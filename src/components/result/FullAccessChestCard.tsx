"use client";

// 自己診断結果ページの末尾に置く宝箱。宝箱の演出（ResultUpgradeTreasure）の最初の場面を、
// そのままページの中に小窓として置く。押すと全画面の演出が「宝箱が開くところ」から始まる。
// 同じタブでクーポンを受け取り済みの人には開いた宝箱を見せ、押すと値札と特典から再開する。
//
// 動き（2026-11-27）: 小窓が画面に入ったときに、宝箱が台座へ落ちてきてAliceが顔を出す（演出の冒頭と同じ動き）。
// そのあとは数秒おきに宝箱が震え、ふたのすき間の光が強まる（押せる・中に何かある、を伝える）。
// 受け取り済みの開いた宝箱は、落とさず・震わせずにそのまま見せる。

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fullAccessCouponReceived, subscribeFullAccessCouponReceived } from "@/components/result/FullAccessTreasure";
import styles from "./FullAccessChestCard.module.css";

const ROOM_SRC = "/result-upgrade/treasure-room.webp";
const CHEST_CLOSED_SRC = "/result-upgrade/treasure-closed.webp";
const CHEST_OPEN_SRC = "/result-upgrade/treasure-open.webp";
const ALICE_SRC = "/result-upgrade/alice-cheer.webp";
// カードの幅は最大460px。宝箱はその54%、Aliceは27%。
const ROOM_SIZES = "(max-width: 492px) 100vw, 460px";
const CHEST_SIZES = "(max-width: 492px) 54vw, 250px";
const ALICE_SIZES = "(max-width: 492px) 27vw, 125px";

export function FullAccessChestCard({ onOpen }: { onOpen: () => void }) {
  const received = useSyncExternalStore(subscribeFullAccessCouponReceived, fullAccessCouponReceived, () => false);
  // 小窓の半分が画面に入ったら「着いた」とする。着くまでは台座だけを見せておく。一度着いたら戻さない。
  const cardRef = useRef<HTMLButtonElement>(null);
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setArrived(true), 0);
      return () => window.clearTimeout(timer);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setArrived(true);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // 受け取り済みの人には、待たせずに開いた宝箱を見せる。
  const waiting = !arrived && !received;
  const lively = arrived && !received;
  return (
    <button ref={cardRef} type="button" className={styles.card} onClick={onOpen}>
      {/* data-treasure-origin: 演出がこの舞台の位置・大きさから全画面へ広がる（ResultUpgradeTreasure）。 */}
      <span className={styles.scene} data-treasure-origin="" aria-hidden="true">
        <Image src={ROOM_SRC} alt="" fill sizes={ROOM_SIZES} className={styles.room} />
        <span className={styles.shade} />
        <span className={styles.stage}>
          <span className={`${styles.glow} ${received ? styles.glowOn : ""}`} />
          <span className={`${styles.chest} ${waiting ? styles.waiting : ""} ${lively ? styles.dropIn : ""}`}>
            <Image src={received ? CHEST_OPEN_SRC : CHEST_CLOSED_SRC} alt="" fill sizes={CHEST_SIZES} className={styles.chestImage} />
            {lively && <span className={styles.seam} />}
          </span>
        </span>
        <span className={`${styles.alice} ${waiting ? styles.waiting : ""} ${lively ? styles.aliceIn : styles.aliceSway}`}>
          <Image src={ALICE_SRC} alt="" fill sizes={ALICE_SIZES} className={styles.chestImage} />
        </span>
      </span>
      <span className={styles.heading}>
        <span className={styles.title}>PRESENT</span>
        <span className={styles.lead}>
          {received ? (
            <>クーポンは<br />受け取り済みです</>
          ) : (
            <>診断してくれた<br />あなたへのプレゼント</>
          )}
        </span>
      </span>
      <span className={`${styles.hint} ${waiting ? styles.waiting : ""} ${lively ? styles.hintIn : styles.hintBob}`}>{received ? "タップして7つの特典を見る" : "宝箱をタップして開けてね"}</span>
    </button>
  );
}
