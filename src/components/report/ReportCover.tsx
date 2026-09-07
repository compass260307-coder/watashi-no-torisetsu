import type { ReactNode } from "react";
import Image from "next/image";
import { selfReportStoryImagePath } from "@/lib/report-story-images";
import styles from "./ReportCover.module.css";

interface ReportCoverProps {
  locale: "ja" | "ko";
  profileLabel: string;
  imageSrc: string;
  imageAlt: string;
  characterName: string;
  title: string;
  subtitle: string;
  quote: string;
  readerLabel: string;
  reportLabel: string;
  coverTitle?: string;
  storyTitle?: string;
  storyImageSrc?: string;
  fullBleed?: boolean;
  metric?: ReactNode;
}

export function ReportCover({
  locale,
  imageSrc,
  imageAlt,
  title,
  coverTitle,
  storyTitle,
  storyImageSrc,
  fullBleed = false,
}: ReportCoverProps) {
  const isKo = locale === "ko";
  const integratedStorySrc =
    storyImageSrc ?? selfReportStoryImagePath(imageSrc) ?? undefined;
  const displayedCoverTitle =
    coverTitle ?? (isKo ? "나의 사용설명서" : "ワタシのトリセツ");
  const displayedStoryTitle =
    storyTitle ?? (isKo ? `${title}의 이야기` : `${title}のストーリー`);

  return (
    <header
      className={`${styles.cover} ${isKo ? styles.coverKo : ""} ${
        integratedStorySrc ? styles.integratedCover : ""
      } ${fullBleed ? styles.fullBleed : ""}`}
    >
      <div className={styles.storyBackdrop} aria-hidden="true">
        <Image
          src={integratedStorySrc ?? "/report/cover-story-world.webp"}
          alt=""
          fill
          sizes="100vw"
          className={`${styles.storyBackdropImage} ${
            integratedStorySrc ? styles.integratedStoryImage : ""
          }`}
          loading="eager"
        />
        <div className={styles.storyShade} />
      </div>
      {!fullBleed ? (
        <>
          <div className={styles.frame} aria-hidden="true" />
          <div className={styles.cornerMark} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </>
      ) : null}
      <div className={styles.masthead}>
        <h1 className={styles.mainTitle}>{displayedCoverTitle}</h1>
      </div>

      <div className={styles.visual}>
        {!integratedStorySrc ? (
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={900}
            height={900}
            className={styles.image}
            preload
          />
        ) : null}
      </div>

      <div className={styles.copy}>
        <p className={styles.storyTitle}>{displayedStoryTitle}</p>
      </div>
    </header>
  );
}
