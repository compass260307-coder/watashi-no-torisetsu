import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportCover } from "@/components/report/ReportCover";
import { ReportPrintButton } from "@/components/report/ReportPrintButton";
import {
  buildIdDeepDiveSections,
  buildIdMoshimoScenes,
  buildIdPartTwo,
  buildIdSelfSections,
} from "@/i18n/id/me";
import { ID_RESULT_AXES, ID_RESULT_TYPES } from "@/i18n/id/result";
import { versionCharacterAssetPath } from "@/lib/character-image";
import { hasSelfReportAccess } from "@/lib/entitlements";
import { cardColorsForGroup, heroColorsForGroup } from "@/lib/hero-colors";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifyThirtyTwoType,
  thirtyTwoColor,
  thirtyTwoGroup,
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";
import styles from "@/app/report/[token]/print/page.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ previewType?: string | string[] }>;
};
type Scores = Partial<Record<BigFiveDimension, number>>;
type Chapter = { title: string; sections: { heading: string; body: string }[] };

const CHAPTER_SCENES: Partial<
  Record<number, "normal1" | "normal2" | "love" | "school" | "work">
> = { 0: "normal1", 2: "love", 3: "normal2", 4: "school", 5: "work", 7: "normal2" };

const join = (items: (string | undefined)[]) => items.filter(Boolean).join("\n\n");
const contentItems = (items: { title: string; body: string }[] | null | undefined) =>
  (items ?? []).map((item) => `${item.title}: ${item.body}`);

function ScoreRows({ scores }: { scores: Scores }) {
  return (
    <div className={styles.scoreList}>
      {ID_RESULT_AXES.map((axis) => {
        const value = Math.round(Math.max(0, Math.min(10, scores[axis.dim] ?? 5)) * 10);
        return (
          <div className={styles.scoreRow} key={axis.dim}>
            <div className={styles.scoreCopy}>
              <div><span className={styles.scoreKey}>{axis.dim}</span><strong>{axis.title}</strong></div>
              <span>{value >= 50 ? axis.highDescription : axis.lowDescription}</span>
            </div>
            <div className={styles.scoreTrack} aria-hidden="true"><span style={{ width: `${value}%`, background: axis.color }} /></div>
            <p>{value}%</p>
          </div>
        );
      })}
    </div>
  );
}

export default async function IndonesianReportPrintPage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;
  const rawPreview = typeof query.previewType === "string" ? query.previewType : "";
  const previewType =
    process.env.NODE_ENV !== "production" && Object.hasOwn(ID_RESULT_TYPES, rawPreview)
      ? (rawPreview as ThirtyTwoTypeId)
      : null;
  const { data: storedUser } = previewType
    ? { data: null }
    : await supabaseAdmin
        .from("users")
        .select("id, display_name, scores, diagnosis_completed_at")
        .eq("owner_token", token)
        .maybeSingle();
  if (!previewType && (!storedUser?.diagnosis_completed_at || !(await hasSelfReportAccess(storedUser.id)))) notFound();

  const data = previewType
    ? { display_name: "Pratinjau", scores: { O: 8, C: 7, E: 5, A: 8, N: 6 } }
    : storedUser;
  if (!data) notFound();

  const scores = (data.scores ?? {}) as Scores;
  const typeId = previewType ?? classifyThirtyTwoType(scores);
  const type = ID_RESULT_TYPES[typeId];
  const selfSections = buildIdSelfSections(typeId, scores);
  const deepDive = buildIdDeepDiveSections(typeId, scores, true);
  const partTwo = buildIdPartTwo(typeId, scores, true);
  const moments = buildIdMoshimoScenes(scores, true);
  const love = deepDive.find((section) => section.key === "love")?.blocks ?? [];
  const career = deepDive.find((section) => section.key === "career")?.blocks ?? [];
  const relations = partTwo.relations ?? [];
  const cautions = partTwo.sceneCautions ?? [];

  const chapters: Chapter[] = [
    {
      title: "Pengantar",
      sections: [
        { heading: "Pola inti Anda", body: selfSections[0].body },
        { heading: "Lima kecenderungan Anda", body: join(ID_RESULT_AXES.map((axis) => (scores[axis.dim] ?? 5) >= 5 ? axis.highDescription : axis.lowDescription)) },
      ],
    },
    {
      title: "Kekuatan dan tantangan",
      sections: [
        { heading: "Kekuatan khas Anda", body: join(contentItems(partTwo.weapons)) },
        { heading: "Pola yang perlu disadari", body: join(contentItems(partTwo.dislikable)) },
      ],
    },
    {
      title: "Cinta dan hubungan romantis",
      sections: love.map((item) => ({ heading: item.heading, body: item.body })),
    },
    {
      title: "Pertemanan",
      sections: [
        { heading: "Cara Anda hadir bersama teman", body: join(relations.filter((item) => item.relation === "Dengan teman").map((item) => item.body)) },
        { heading: "Hal yang perlu diperhatikan", body: join(cautions.filter((item) => item.scene === "Dengan teman").map((item) => item.body)) },
      ],
    },
    {
      title: "Keluarga",
      sections: [
        { heading: "Cara Anda merawat hubungan keluarga", body: join(relations.filter((item) => item.relation === "Dengan keluarga").map((item) => item.body)) },
        { heading: "Ruang untuk bertumbuh", body: join(cautions.filter((item) => item.scene === "Dengan keluarga").map((item) => item.body)) },
      ],
    },
    {
      title: "Karier dan tujuan",
      sections: career.map((item) => ({ heading: item.heading, body: item.body })),
    },
    {
      title: "Pola di tempat kerja",
      sections: [
        { heading: "Hubungan di tempat kerja", body: join(relations.filter((item) => item.relation === "Di tempat kerja").map((item) => item.body)) },
        { heading: "Titik tekanan", body: join(cautions.filter((item) => item.scene === "Dalam karier").map((item) => item.body)) },
      ],
    },
    {
      title: "Diri Anda dalam berbagai situasi",
      sections: [{ heading: "Respons alami Anda", body: join(moments.map((item) => `${item.title}: ${item.body}`)) }],
    },
  ];

  const color = thirtyTwoColor(typeId);
  const group = thirtyTwoGroup(typeId);
  const { heroBg: coverBackground, codeTint: coverAccent } = heroColorsForGroup(group);
  const { panelBg: coverSoft } = cardColorsForGroup(group);
  const cutImagePath = versionCharacterAssetPath(thirtyTwoImagePath(typeId).replace("/characters/v3/", "/characters/cut/"));
  const reportStyle = {
    "--report-accent": color,
    "--report-accent-soft": `${color}2B`,
    "--report-accent-wash": `${color}12`,
    "--cover-background": coverBackground,
    "--cover-accent": coverAccent,
    "--cover-accent-soft": `${coverAccent}38`,
    "--cover-soft": coverSoft,
  } as CSSProperties;
  const reader = data.display_name?.trim() || "Anda";

  return (
    <main className={styles.reportRoot} style={reportStyle} lang="id">
      <div className={styles.screenToolbar}><p>Pratinjau laporan kepribadian</p><ReportPrintButton locale="id" /></div>
      <article className={styles.reportDocument}>
        <ReportCover
          locale="id"
          profileLabel="PROFIL KEPRIBADIAN"
          imageSrc={cutImagePath}
          imageAlt={type.name}
          characterName={type.name}
          title={type.essence}
          subtitle="Profil kepribadian"
          quote={`“${type.oneLiner}”`}
          readerLabel={`Laporan ${reader}`}
          reportLabel="LAPORAN PENEMUAN DIRI"
          coverTitle="Panduan Kepribadian Saya"
          storyTitle={`Kisah ${type.name}`}
          fullBleed
        />
        <section className={styles.overviewPage}>
          <p className={styles.pageEyebrow}>PROFIL ANDA</p>
          <h2 className={styles.overviewTitle}>Cara membaca laporan ini</h2>
          <p className={styles.leadText}>Laporan ini menggabungkan lima dimensi kepribadian dan pola karakter <strong>{type.name}</strong>. Tidak ada kecenderungan yang mutlak baik atau buruk. Gunakan bagian yang terasa sesuai untuk memahami pilihan, hubungan, dan cara bertumbuh Anda.</p>
          <div className={styles.profileStatement}><p>Inti pola {type.essence}</p><strong>{type.oneLiner}</strong></div>
          <div className={styles.scoreSection}><div className={styles.sectionHeadingRow}><h3>Lima dimensi Anda</h3><span>Skor penilaian diri / 100</span></div><ScoreRows scores={scores} /></div>
          <nav className={styles.contents} aria-label="Daftar isi"><p className={styles.contentsLabel}>DAFTAR ISI</p><ol>{chapters.map((chapter, index) => <li key={chapter.title}><span>{String(index + 1).padStart(2, "0")}</span><span>{chapter.title}</span></li>)}</ol></nav>
        </section>
        {chapters.map((chapter, index) => {
          const sceneVariant = CHAPTER_SCENES[index];
          const scenePath = sceneVariant ? versionCharacterAssetPath(`/characters/scenes/${group}_${sceneVariant}.webp`) : null;
          return (
            <section className={`${styles.chapter} ${index === 2 ? styles.flowChapter : ""}`} key={chapter.title}>
              <header className={styles.chapterHeader}><p className={styles.chapterNumber}>BAB {String(index + 1).padStart(2, "0")}</p><h2>{chapter.title}</h2><span className={styles.chapterRule} aria-hidden="true" /></header>
              {scenePath ? <figure className={styles.sceneFigure}><Image src={scenePath} alt="" width={1500} height={850} className={styles.sceneImage} loading="eager" sizes="680px" /></figure> : null}
              <div className={styles.chapterBody}>{chapter.sections.map((section, sectionIndex) => <div className={`${styles.sectionBlock} ${sectionIndex === 0 ? styles.firstSection : ""}`} key={section.heading}><h3>{section.heading}</h3>{section.body.split("\n\n").filter(Boolean).map((paragraph, paragraphIndex) => <p className={styles.bodyParagraph} key={paragraphIndex}>{paragraph}</p>)}</div>)}</div>
            </section>
          );
        })}
        <footer className={styles.endPage}>
          <p className={styles.pageEyebrow}>SIMPAN DEKAT-DEKAT</p>
          <h2>Kembali saat Anda membutuhkan arah.</h2>
          <p>Kepribadian adalah peta untuk memahami diri, bukan vonis yang membatasi Anda. Buka kembali laporan ini ketika pengalaman baru mengubah apa yang Anda lihat dalam diri sendiri.</p>
          <div className={styles.endMark}>PANDUAN KEPRIBADIAN SAYA</div>
          <Link className={styles.backLink} href={`/id/me/${encodeURIComponent(previewType ? "preview" : token)}`}>Lihat hasil lengkap saya</Link>
        </footer>
      </article>
    </main>
  );
}
