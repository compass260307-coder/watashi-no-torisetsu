import { ID_RESULT_AXES, ID_RESULT_TYPES } from "@/i18n/id/result";
import {
  ID_CAREER_BY_TYPE_32,
  ID_LOVE_BY_TYPE_32,
  ID_ME_RULES,
  ID_MOSHIMO_SCENES,
  ID_PERCEIVED_BY_TYPE_32,
  ID_SELF_RESULT_CONTENT_32,
} from "@/i18n/id/me-content-32";
import type { ResolvedDeepDiveSection } from "@/lib/deep-dive-resolve";
import type { MoshimoScene } from "@/lib/moshimo-resolve";
import type { ResolvedPartTwo } from "@/lib/part-two-resolve";
import type { SelfSection } from "@/lib/self-result-content";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

type Scores = Partial<Record<BigFiveDimension, number>>;
type HighLow = "H" | "L";
type Quad = "HH" | "HL" | "LH" | "LL";
type SceneRule = {
  title: string;
  chipLabel: string;
  color: string;
  gated: boolean;
  main: { dim: BigFiveDimension; high: string; low: string };
  spice: { dim: BigFiveDimension; high: string; low: string };
};

const DIMS = ["O", "C", "E", "A", "N"] as const;
const WEAPON_SUBJECTS = [
  "Teman Anda",
  "Orang-orang di sekitar Anda",
  "Sebenarnya, teman Anda",
  "Semua orang",
  "Teman-teman terdekat Anda",
  "Tanpa Anda sadari, orang-orang di sekitar Anda",
] as const;
const LOVE_SPLITS = ID_ME_RULES.LOVE_SPLITS as unknown as Partial<
  Record<ThirtyTwoTypeId, readonly [number, number]>
>;

function highLow(scores: Scores, dim: BigFiveDimension): HighLow {
  return high(scores, dim) ? "H" : "L";
}

function quad(
  scores: Scores,
  first: BigFiveDimension,
  second: BigFiveDimension,
): Quad {
  return `${highLow(scores, first)}${highLow(scores, second)}` as Quad;
}

function axis(dim: BigFiveDimension) {
  const value = ID_RESULT_AXES.find((item) => item.dim === dim);
  if (!value) throw new Error(`Unknown Big Five dimension: ${dim}`);
  return value;
}

function high(scores: Scores, dim: BigFiveDimension) {
  return (scores[dim] ?? 5) >= 5;
}

function percent(scores: Scores, dim: BigFiveDimension) {
  return Math.max(0, Math.min(100, Math.round((scores[dim] ?? 5) * 10)));
}

function description(scores: Scores, dim: BigFiveDimension) {
  const item = axis(dim);
  return high(scores, dim) ? item.highDescription : item.lowDescription;
}

function strength(scores: Scores, dim: BigFiveDimension) {
  const item = axis(dim);
  return high(scores, dim) ? item.highStrength : item.lowStrength;
}

function growth(scores: Scores, dim: BigFiveDimension) {
  const item = axis(dim);
  return high(scores, dim) ? item.highGrowth : item.lowGrowth;
}

function rankedDimensions(scores: Scores) {
  return DIMS.toSorted(
    (left, right) =>
      Math.abs((scores[right] ?? 5) - 5) -
      Math.abs((scores[left] ?? 5) - 5),
  );
}

export function buildIdSelfSections(
  typeId: ThirtyTwoTypeId,
  scores: Scores,
): SelfSection[] {
  const dedicated = ID_SELF_RESULT_CONTENT_32[typeId];
  if (dedicated) return dedicated;

  const type = ID_RESULT_TYPES[typeId];
  const [first, second, third] = rankedDimensions(scores);
  return [
    {
      title: "Panduan penggunaan",
      heading: `${type.name} — cara alami Anda bergerak di dunia`,
      body: `${type.oneLiner} ${description(scores, first)} Karena itu, orang lain sering melihat ciri khas Anda bahkan sebelum Anda sendiri menyadarinya.\n\n${strength(scores, first)} ${strength(scores, second)} Perpaduan ini membuat sosok “${type.essence}” dalam diri Anda terasa nyata dalam tindakan sehari-hari.\n\n${description(scores, third)} Anda paling bersinar ketika dapat menggunakan kekuatan ini tanpa harus mengikuti ritme yang tidak sesuai dengan diri sendiri.\n\nAgar dapat berhubungan baik dengan Anda, orang lain perlu menghargai cara Anda berpikir, memberi ruang untuk memproses sesuatu, dan menyampaikan harapan secara jelas. Pengakuan yang spesifik jauh lebih bermakna bagi Anda daripada pujian yang samar.`,
    },
    {
      title: "Hal yang perlu diperhatikan",
      heading: "Saat kekuatan Anda bekerja terlalu keras",
      body: `${growth(scores, first)} Kekuatan terbesar pun dapat terasa berat ketika Anda lelah atau sedang berada di bawah tekanan.\n\n${growth(scores, second)} Jangan menunggu sampai semuanya menumpuk; penyesuaian kecil yang dilakukan lebih awal biasanya jauh lebih efektif.\n\n${growth(scores, third)} Pada hari yang sulit, beri diri Anda izin untuk meminta bantuan, menunda jawaban, atau mengubah cara yang biasanya digunakan.\n\nHal-hal ini bukan kekurangan yang harus dihapus. Ini adalah petunjuk agar kualitas baik Anda dapat dipakai lebih lama, lebih lembut, dan tanpa mengorbankan diri sendiri.`,
    },
    {
      title: "Pasangan yang cocok",
      heading: "Orang yang membantu Anda menjadi versi terbaik",
      body: `Anda cenderung cocok dengan orang yang menghargai ritme dan cara berpikir Anda, tetapi tetap dapat menyampaikan pendapatnya dengan jujur. ${description(scores, "A")} ${growth(scores, "E")}\n\nBaik dalam pertemanan maupun cinta, hubungan terasa paling sehat ketika kedua pihak dapat berbagi tanggung jawab, memberi ruang tanpa menjauh, dan membicarakan kebutuhan sebelum berubah menjadi kesalahpahaman.`,
    },
  ];
}

function idLoveEndure(scores: Scores) {
  const prose = ID_ME_RULES.LOVE_ENDURE_PROSE as Record<
    BigFiveDimension,
    Record<HighLow, string>
  >;
  const pick = (dim: BigFiveDimension) => prose[dim][highLow(scores, dim)];
  return [
    pick("N"),
    pick("A"),
    `${pick("E")}${pick("C")}`,
    ID_ME_RULES.LOVE_ENDURE_CLOSING,
  ].join("\n\n");
}

function idCareerRelations(scores: Scores) {
  const prose = ID_ME_RULES.CAREER_RELATIONS_PROSE as Record<
    BigFiveDimension,
    Record<HighLow, string>
  >;
  const pick = (dim: BigFiveDimension) => prose[dim][highLow(scores, dim)];
  return [
    pick("E"),
    pick("A"),
    `${pick("N")}${pick("C")}`,
    ID_ME_RULES.CAREER_RELATIONS_CLOSING,
  ].join("\n\n");
}

export function buildIdDeepDiveSections(
  typeId: ThirtyTwoTypeId,
  scores: Scores,
  unlocked: boolean,
): ResolvedDeepDiveSection[] {
  const type = ID_RESULT_TYPES[typeId];
  const gate = (heading: string, body: string) =>
    unlocked ? { heading, body } : { heading, body: "", locked: true as const };
  const loveSource = ID_LOVE_BY_TYPE_32[typeId];
  const loveSplit = LOVE_SPLITS[typeId];
  const loveParagraphs = loveSource?.body.split("\n\n") ?? [];
  const lovePayoffStart = loveSplit ? loveSplit[0] + loveSplit[1] : 0;
  const loveBlocks =
    loveSource &&
    loveSplit &&
    lovePayoffStart > 0 &&
    lovePayoffStart < loveParagraphs.length
      ? [
          {
            heading: ID_ME_RULES.LOVE_HEADINGS[0],
            body: loveParagraphs.slice(0, lovePayoffStart).join("\n\n"),
          },
          gate(
            ID_ME_RULES.LOVE_HEADINGS[1],
            loveParagraphs.slice(lovePayoffStart).join("\n\n"),
          ),
          gate(ID_ME_RULES.LOVE_ENDURE_HEADING, idLoveEndure(scores)),
        ]
      : [
          {
            heading: "Daya tarik Anda dalam cinta",
            body: `${type.oneLiner}\n\n${strength(scores, "A")} ${description(scores, "E")}\n\n${description(scores, "N")} Inilah alasan perhatian dan cara Anda mendekat terasa khas bagi orang yang menyukai Anda.`,
          },
          gate(
            "Panduan bagi orang yang menyukai Anda",
            `${description(scores, "N")}\n\n${growth(scores, "A")} ${growth(scores, "E")}\n\nHubungan dengan Anda berkembang ketika perhatian tidak hanya ditebak, tetapi juga dinyatakan lewat kata-kata dan tindakan yang konsisten.`,
          ),
          gate(ID_ME_RULES.LOVE_ENDURE_HEADING, idLoveEndure(scores)),
        ];

  const careerSource = ID_CAREER_BY_TYPE_32[typeId];
  const careerParagraphs = careerSource?.body.split("\n\n") ?? [];
  const careerBlocks =
    careerSource && careerParagraphs.length >= 4
      ? [
          {
            heading: ID_ME_RULES.CAREER_HEADINGS[0],
            body: careerParagraphs.slice(0, 2).join("\n\n"),
          },
          gate(ID_ME_RULES.CAREER_HEADINGS[1], careerParagraphs[2]),
          gate(
            ID_ME_RULES.CAREER_RELATIONS_HEADING,
            idCareerRelations(scores),
          ),
        ]
      : [
          {
            heading: "Cara Anda bekerja",
            body: `${strength(scores, "C")} ${description(scores, "O")}\n\n${type.oneLiner} Dalam pekerjaan, ciri ini terlihat dari cara Anda memilih prioritas, menjaga kualitas, dan merespons perubahan.`,
          },
          gate(
            "Gaya kerja yang cocok dan lingkungan yang perlu dihindari",
            `${strength(scores, "O")} ${growth(scores, "C")} Lingkungan terbaik memberi tujuan yang jelas sekaligus cukup ruang untuk menggunakan cara kerja Anda sendiri.`,
          ),
          gate(
            ID_ME_RULES.CAREER_RELATIONS_HEADING,
            idCareerRelations(scores),
          ),
        ];
  return [
    {
      key: "love",
      tab: "Kecenderungan dalam cinta",
      note: `Keramahan Anda berada di ${percent(scores, "A")}%.`,
      body: loveBlocks.filter((item) => !item.locked).map((item) => item.body).join("\n\n"),
      blocks: loveBlocks,
      locked: false,
    },
    {
      key: "career",
      tab: "Kecenderungan karier",
      note: `Ketelitian Anda berada di ${percent(scores, "C")}%.`,
      body: careerBlocks.filter((item) => !item.locked).map((item) => item.body).join("\n\n"),
      blocks: careerBlocks,
      locked: false,
    },
  ];
}

function idLikable(scores: Scores): string[] {
  const prose = ID_ME_RULES.LIKABLE_PROSE as Record<
    BigFiveDimension,
    Record<HighLow, string>
  >;
  const pick = (dim: BigFiveDimension) => prose[dim][highLow(scores, dim)];
  return [
    pick("E"),
    `${pick("A")}${pick("C")}`,
    `${pick("O")}${pick("N")}`,
    ID_ME_RULES.LIKABLE_CLOSING,
  ];
}

function idRelations(scores: Scores) {
  const friend = ID_ME_RULES.RELATION_FRIEND as Record<Quad, string>;
  const lover = ID_ME_RULES.RELATION_LOVER as Record<Quad, string>;
  const family = ID_ME_RULES.RELATION_FAMILY as Record<Quad, string>;
  const boss = ID_ME_RULES.RELATION_BOSS as Record<Quad, string>;
  return [
    { relation: "Dari sudut pandang teman", body: friend[quad(scores, "E", "A")] },
    { relation: "Dari sudut pandang pasangan", body: lover[quad(scores, "A", "N")] },
    { relation: "Dari sudut pandang keluarga", body: family[quad(scores, "C", "E")] },
    { relation: "Dari sudut pandang atasan atau senior", body: boss[quad(scores, "C", "A")] },
  ];
}

function idSceneCautions(scores: Scores) {
  const friend = ID_ME_RULES.SCENE_FRIEND as Record<Quad, string>;
  const lover = ID_ME_RULES.SCENE_LOVER as Record<Quad, string>;
  const career = ID_ME_RULES.SCENE_CAREER as Record<Quad, string>;
  const family = ID_ME_RULES.SCENE_FAMILY as Record<Quad, string>;
  return [
    { scene: "Saat bersama teman", body: friend[quad(scores, "E", "A")] },
    { scene: "Saat bersama pasangan", body: lover[quad(scores, "A", "N")] },
    { scene: "Dalam karier", body: career[quad(scores, "C", "N")] },
    { scene: "Saat bersama keluarga", body: family[quad(scores, "C", "E")] },
  ];
}

function idPerceivedItems(
  items: { title: string; body: string }[],
  tails: readonly string[],
  subjects?: readonly string[],
) {
  return items.map((item, index) => ({
    ...item,
    body: `${item.body.replaceAll(
      "{B}",
      subjects?.[index % subjects.length] ?? "Teman",
    )} ${tails[index % tails.length]}`,
  }));
}

export function buildIdPartTwo(
  typeId: ThirtyTwoTypeId,
  scores: Scores,
  unlocked: boolean,
): ResolvedPartTwo {
  const type = ID_RESULT_TYPES[typeId];
  const perceived = ID_PERCEIVED_BY_TYPE_32[typeId];
  const [top] = rankedDimensions(scores);
  return {
    likable: idLikable(scores),
    weapons: perceived
      ? idPerceivedItems(
          perceived.strengths,
          ID_ME_RULES.WEAPON_TAIL,
          WEAPON_SUBJECTS,
        )
      : [
          { title: "Kekuatan khas Anda", body: type.oneLiner },
          ...DIMS.map((dim) => ({
            title: `Kekuatan ${axis(dim).title}`,
            body: strength(scores, dim),
          })),
        ],
    dislikable: unlocked
      ? perceived
        ? idPerceivedItems(perceived.surprises, ID_ME_RULES.DISLIKE_TAIL)
        : [
            {
              title: "Saat kekuatan khas Anda disalahpahami",
              body: `${type.oneLiner} Namun, ketika muncul terlalu kuat, orang lain mungkin membutuhkan penjelasan tentang maksud Anda.`,
            },
            ...DIMS.map((dim) => ({
              title: `Saat ${axis(dim).title.toLowerCase()} disalahpahami`,
              body: growth(scores, dim),
            })),
          ]
      : null,
    relations: unlocked ? idRelations(scores) : null,
    sceneCautions: unlocked ? idSceneCautions(scores) : null,
    gapTeaser: `Sisi “${axis(top).title}” yang terasa paling kuat bagi Anda mungkin terlihat dengan intensitas berbeda di mata teman.`,
    locked: !unlocked,
  };
}

const SCENES: readonly SceneRule[] = ID_MOSHIMO_SCENES.map((scene) => ({
  title: scene.title,
  chipLabel: scene.chipLabel,
  color: scene.color,
  gated: scene.gated,
  main: { ...scene.main },
  spice: { ...scene.spice },
}));

export function buildIdMoshimoScenes(
  scores: Scores,
  unlocked: boolean,
): MoshimoScene[] {
  const pick = (rule: SceneRule["main"]) => rule[high(scores, rule.dim) ? "high" : "low"];
  return SCENES.map((scene) => {
    const locked = scene.gated && !unlocked;
    return { title: scene.title, chipLabel: scene.chipLabel, color: scene.color, body: locked ? "" : `${pick(scene.main)} ${pick(scene.spice)}`, locked };
  });
}
