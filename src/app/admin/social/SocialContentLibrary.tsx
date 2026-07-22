"use client";

import Image from "next/image";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./social-content.module.css";

type Group = "sky" | "land" | "sea" | "unknown";
type Variant = "N" | "R";

export type SocialCharacter = {
  id: string;
  mbti: string;
  variant: Variant;
  variantLabel: string;
  group: Group;
  characterName: string;
  visualName: string;
  oneLiner: string;
  catchphrase: string;
  shortDescription: string;
  ocean: {
    code: string;
    flags: {
      letter: "O" | "C" | "E" | "A" | "N";
      high: boolean;
      label: string;
    }[];
  };
  storyHeading: string;
  storyBody: string;
  normalImage: Asset;
  compatibilityImage: Asset;
};

type Asset = {
  src: string;
  fileName: string;
  sourceFile: string;
};

const GROUPS: { key: "all" | Group; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "sea", label: "海" },
  { key: "land", label: "陸" },
  { key: "sky", label: "空" },
  { key: "unknown", label: "未知" },
];

const VARIANTS: { key: "all" | Variant; label: string }[] = [
  { key: "all", label: "N / R すべて" },
  { key: "N", label: "N・繊細" },
  { key: "R", label: "R・安定" },
];

const GROUP_META: Record<
  Group,
  { label: string; accent: string; deep: string; stage: string }
> = {
  sea: {
    label: "海グループ",
    accent: "#61c6cf",
    deep: "#155d66",
    stage: "#dff6f7",
  },
  land: {
    label: "陸グループ",
    accent: "#8dc16e",
    deep: "#426f31",
    stage: "#eaf5df",
  },
  sky: {
    label: "空グループ",
    accent: "#e2bd48",
    deep: "#80651a",
    stage: "#fff4c9",
  },
  unknown: {
    label: "未知グループ",
    accent: "#aa86cf",
    deep: "#66458b",
    stage: "#f0e8f8",
  },
};

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function createPostSet(character: SocialCharacter) {
  const traits = character.ocean.flags
    .map(({ letter, label }) => `${letter}: ${label}`)
    .join(" / ");

  return `【${character.characterName}｜${character.mbti}】\n${character.visualName}\nOCEAN: ${character.ocean.code}（${traits}）\n\n${character.oneLiner}\n\n${character.storyHeading}\n${character.storyBody}`;
}

function AssetDownload({
  asset,
  label,
  note,
}: {
  asset: Asset;
  label: string;
  note: string;
}) {
  return (
    <div className={styles.assetItem}>
      <div className={styles.assetThumb}>
        <Image
          src={asset.src}
          alt=""
          fill
          sizes="92px"
          className={styles.assetThumbImage}
        />
      </div>
      <div className={styles.assetText}>
        <strong>{label}</strong>
        <span>{note}</span>
      </div>
      <a
        href={asset.src}
        download={asset.fileName}
        className={styles.downloadButton}
        aria-label={`${label}をダウンロード`}
      >
        <span aria-hidden="true">↓</span>
        DL
      </a>
    </div>
  );
}

export default function SocialContentLibrary({
  characters,
}: {
  characters: SocialCharacter[];
}) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<"all" | Group>("all");
  const [activeVariant, setActiveVariant] = useState<"all" | Variant>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ja");

    return characters.filter((character) => {
      if (activeGroup !== "all" && character.group !== activeGroup) return false;
      if (activeVariant !== "all" && character.variant !== activeVariant) return false;
      if (!normalized) return true;

      return [
        character.mbti,
        character.variant,
        character.characterName,
        character.visualName,
        character.ocean.code,
        character.oneLiner,
        character.catchphrase,
        character.shortDescription,
        character.storyHeading,
        character.storyBody,
        GROUP_META[character.group].label,
      ]
        .join(" ")
        .toLocaleLowerCase("ja")
        .includes(normalized);
    });
  }, [activeGroup, activeVariant, characters, query]);

  const copyText = async (key: string, text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      setCopiedKey(key);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      fallbackCopy(text);
      setCopiedKey(key);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.mastheadInner}>
          <a href="/admin" className={styles.brand} aria-label="管理画面へ戻る">
            <span className={styles.brandMark}>W</span>
            <span>
              WATASHI NO TORISETSU
              <small>SOCIAL STUDIO</small>
            </span>
          </a>
          <span className={styles.internalBadge}>INTERNAL</span>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>SOCIAL CONTENT LIBRARY</p>
          <h1>
            投稿の種が、
            <br />
            <span>ここに揃う。</span>
          </h1>
          <p className={styles.heroDescription}>
            32キャラの性格コピーと画像素材を、探す・コピーする・ダウンロードする。
            <br className={styles.desktopBreak} />
            SNS制作のための社内ライブラリです。
          </p>
        </div>

        <div className={styles.heroStats} aria-label="収録内容">
          <div>
            <strong>32</strong>
            <span>CHARACTERS</span>
          </div>
          <div>
            <strong>16</strong>
            <span>MBTI TYPES</span>
          </div>
          <div>
            <strong>2</strong>
            <span>IMAGE SETS</span>
          </div>
        </div>
      </section>

      <section className={styles.workspace} aria-label="キャラクター検索と一覧">
        <div className={styles.toolbar}>
          <label className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>
            <span className={styles.srOnly}>キャラを検索</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="MBTI・キャラ名・OCEAN・性格文で検索"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="検索をクリア">
                ×
              </button>
            ) : null}
          </label>

          <div className={styles.filterBlock}>
            <span className={styles.filterLabel}>GROUP</span>
            <div className={styles.chipRow} aria-label="グループで絞り込む">
              {GROUPS.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  className={activeGroup === group.key ? styles.activeChip : styles.chip}
                  onClick={() => setActiveGroup(group.key)}
                  aria-pressed={activeGroup === group.key}
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterBlock}>
            <span className={styles.filterLabel}>VARIANT</span>
            <div className={styles.chipRow} aria-label="N・Rで絞り込む">
              {VARIANTS.map((variant) => (
                <button
                  key={variant.key}
                  type="button"
                  className={
                    activeVariant === variant.key ? styles.activeChip : styles.chip
                  }
                  onClick={() => setActiveVariant(variant.key)}
                  aria-pressed={activeVariant === variant.key}
                >
                  {variant.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.resultHeader}>
          <p>
            <strong>{filtered.length}</strong> / {characters.length} CHARACTERS
          </p>
          <p>カード内の文章と画像は、そのままSNS制作に使用できます。</p>
        </div>

        {filtered.length ? (
          <div className={styles.cardGrid}>
            {filtered.map((character, index) => {
              const group = GROUP_META[character.group];
              const storyParagraphs = character.storyBody.split("\n\n");
              const cardStyle = {
                "--card-accent": group.accent,
                "--card-deep": group.deep,
                "--card-stage": group.stage,
              } as CSSProperties;

              return (
                <article key={character.id} className={styles.card} style={cardStyle}>
                  <div className={styles.visual}>
                    <div className={styles.visualMeta}>
                      <span>{group.label}</span>
                      <span className={styles.sequence}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className={styles.characterImage}>
                      <Image
                        src={character.normalImage.src}
                        alt={`${character.visualName}（${character.characterName}）`}
                        fill
                        sizes="(max-width: 720px) 92vw, (max-width: 1180px) 46vw, 31vw"
                        className={styles.characterImageAsset}
                      />
                    </div>
                    <div className={styles.identityBadges}>
                      <span>{character.mbti}</span>
                      <span>{character.variant}</span>
                      <span>{character.ocean.code}</span>
                    </div>
                  </div>

                  <div className={styles.cardBody}>
                    <p className={styles.roleLabel}>CHARACTER NAME</p>
                    <div className={styles.titleRow}>
                      <div>
                        <h2>{character.characterName}</h2>
                        <p>{character.visualName}</p>
                      </div>
                      <span className={styles.mbtiBadge}>MBTI {character.mbti}</span>
                    </div>

                    <blockquote>{character.oneLiner}</blockquote>

                    <div className={styles.oceanSection}>
                      <div className={styles.sectionHeading}>
                        <span>OCEAN LABEL</span>
                        <strong>{character.ocean.code}</strong>
                      </div>
                      <div className={styles.traitGrid}>
                        {character.ocean.flags.map((flag) => (
                          <div key={flag.letter} className={styles.trait}>
                            <span className={flag.high ? styles.highTrait : styles.lowTrait}>
                              {flag.letter}
                            </span>
                            <p>
                              <strong>{flag.high ? "HIGH" : "LOW"}</strong>
                              {flag.label}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.storyIntro}>
                      <div className={styles.sectionHeading}>
                        <span>PERSONALITY STORY</span>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(`${character.id}-story`, character.storyBody)
                          }
                        >
                          {copiedKey === `${character.id}-story` ? "コピー済み" : "本文をコピー"}
                        </button>
                      </div>
                      <h3>{character.storyHeading}</h3>
                      <p className={styles.storyPreview}>{storyParagraphs[0]}</p>
                      <details className={styles.storyDetails}>
                        <summary>ストーリー全文を読む</summary>
                        <div className={styles.storyFull}>
                          {storyParagraphs.map((paragraph) => (
                            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                          ))}
                        </div>
                      </details>
                    </div>

                    <div className={styles.copyActions}>
                      <button
                        type="button"
                        className={styles.primaryAction}
                        onClick={() =>
                          copyText(`${character.id}-set`, createPostSet(character))
                        }
                      >
                        <span aria-hidden="true">⧉</span>
                        {copiedKey === `${character.id}-set`
                          ? "投稿セットをコピーしました"
                          : "投稿セットをコピー"}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryAction}
                        onClick={() =>
                          copyText(`${character.id}-short`, character.oneLiner)
                        }
                      >
                        {copiedKey === `${character.id}-short` ? "コピー済み" : "短文だけコピー"}
                      </button>
                    </div>

                    <details className={styles.assetDetails}>
                      <summary>
                        <span>
                          <strong>IMAGE ASSETS</strong>
                          通常＋相性アイコン
                        </span>
                        <span aria-hidden="true">＋</span>
                      </summary>
                      <div className={styles.assetList}>
                        <AssetDownload
                          asset={character.normalImage}
                          label="通常キャラ画像"
                          note="投稿・結果ビジュアル向け"
                        />
                        <AssetDownload
                          asset={character.compatibilityImage}
                          label="相性アイコン画像"
                          note="顔アップ・丸アイコン向け"
                        />
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">⌕</span>
            <h2>該当するキャラが見つかりません</h2>
            <p>検索ワードや絞り込み条件を変えてみてください。</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveGroup("all");
                setActiveVariant("all");
              }}
            >
              条件をリセット
            </button>
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <p>WATASHI NO TORISETSU / SOCIAL CONTENT LIBRARY</p>
        <p>キャラクターデータと連動しています。</p>
      </footer>

      <div className={styles.toast} data-visible={Boolean(copiedKey)} aria-live="polite">
        <span aria-hidden="true">✓</span>
        クリップボードにコピーしました
      </div>
    </main>
  );
}
