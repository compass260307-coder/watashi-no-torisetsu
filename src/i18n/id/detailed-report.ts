import {
  buildIdDeepDiveSections,
  buildIdPartTwo,
  buildIdSelfSections,
} from "@/i18n/id/me";
import { ID_RESULT_AXES, ID_RESULT_TYPES } from "@/i18n/id/result";
import type { DetailedReport, ReportBullet } from "@/lib/detailed-report-content";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

type Scores = Partial<Record<BigFiveDimension, number>>;

const OCEAN: readonly BigFiveDimension[] = ["O", "C", "E", "A", "N"];

function score(scores: Scores, dimension: BigFiveDimension): number {
  return typeof scores[dimension] === "number" ? scores[dimension]! : 5;
}

function axis(dimension: BigFiveDimension) {
  return ID_RESULT_AXES.find((item) => item.dim === dimension)!;
}

function strongest(scores: Scores): BigFiveDimension[] {
  return [...OCEAN].sort(
    (left, right) =>
      Math.abs(score(scores, right) - 5) - Math.abs(score(scores, left) - 5),
  );
}

function careBullets(scores: Scores): ReportBullet[] {
  return strongest(scores).map((dimension) => {
    const item = axis(dimension);
    const high = score(scores, dimension) >= 5;
    return {
      title: high
        ? `Rawat kekuatan ${item.title.toLowerCase()}`
        : `Hormati ritme ${item.title.toLowerCase()} Anda`,
      body: high
        ? `${item.highStrength} Saat mendampingi pertumbuhan orang lain, gunakan kekuatan ini sambil memberi mereka ruang untuk menemukan cara sendiri.`
        : `${item.lowStrength} Saat mendampingi pertumbuhan orang lain, jelaskan tujuan dengan tenang dan biarkan prosesnya tetap lentur.`,
    };
  });
}

function blocksToSections(
  blocks: { heading: string; body: string; locked?: boolean }[],
) {
  return blocks
    .filter((block) => !block.locked && block.body)
    .map((block) => ({ heading: block.heading, body: block.body }));
}

export function buildIdDetailedReport(
  typeId: ThirtyTwoTypeId,
  scores: Scores,
): DetailedReport {
  const type = ID_RESULT_TYPES[typeId];
  const selfSections = buildIdSelfSections(typeId, scores);
  const deepDive = buildIdDeepDiveSections(typeId, scores, true);
  const partTwo = buildIdPartTwo(typeId, scores, true);
  const love = deepDive.find((section) => section.key === "love");
  const career = deepDive.find((section) => section.key === "career");
  const [topAxis, secondAxis] = strongest(scores);

  return {
    chapters: [
      {
        title: "Pengantar",
        sections: [
          {
            heading: `${type.name}, inilah diri Anda`,
            quote: type.oneLiner,
            body: selfSections[0]?.body,
          },
          {
            heading: "Cara membaca laporan ini",
            body: `Laporan ini bukan jawaban untuk mengurung Anda dalam satu kotak. Berdasarkan lima kecenderungan yang tampak dalam penilaian diri saat ini, laporan ini membantu melihat kapan kekuatan Anda muncul secara alami dan kapan sisi tertentu perlu ditangani dengan lembut.\n\nDua kecenderungan yang paling menonjol adalah ${axis(topAxis).title} dan ${axis(secondAxis).title}. Simpan kalimat yang terasa tepat, dan baca bagian yang belum sesuai sebagai ruang yang masih dapat berubah.`,
          },
        ],
      },
      {
        title: "Kekuatan dan perhatian",
        sections: [
          {
            heading: "Kekuatan yang sudah Anda miliki",
            bullets: partTwo.weapons ?? [],
          },
          {
            heading: selfSections[1]?.heading ?? "Ketika kekuatan menjadi terlalu besar",
            body: selfSections[1]?.body,
          },
          {
            heading: "Saat Anda mudah disalahpahami oleh orang terdekat",
            bullets: partTwo.dislikable ?? [],
          },
        ],
      },
      {
        title: "Hubungan romantis",
        sections: love ? blocksToSections(love.blocks ?? []) : [],
      },
      {
        title: "Pertemanan",
        sections: [
          {
            heading: "Sisi Anda yang disukai teman",
            body: partTwo.likable.join("\n\n"),
          },
          {
            heading: "Diri Anda dalam setiap hubungan",
            bullets: (partTwo.relations ?? []).map((item) => ({
              title: item.relation,
              body: item.body,
            })),
          },
        ],
      },
      {
        title: "Pengasuhan dan kepedulian",
        sections: [
          {
            heading: "Saat mendampingi pertumbuhan seseorang",
            quote: "Kepedulian yang baik bukan membentuk orang lain menjadi seperti kita, melainkan menjaga ruang agar mereka menemukan ritmenya sendiri.",
            body: `Tipe ${type.name} secara alami membawa nilai yang dianggap penting ke dalam cara merawat orang lain. Karena itu Anda mampu memperhatikan detail dan memberi arah, tetapi tetap penting untuk memastikan bahwa ritme yang nyaman bagi Anda juga sesuai bagi mereka.\n\nHal yang sama berlaku saat membimbing junior atau merawat keluarga. Ketika Anda menyeimbangkan bantuan langsung dengan kesempatan bagi mereka untuk mencoba sendiri, kekuatan Anda menjadi dukungan yang kokoh, bukan kendali.`,
          },
          {
            heading: "Cara menjaga kepedulian khas Anda",
            bullets: careBullets(scores),
          },
        ],
      },
      {
        title: "Jalur karier",
        sections: career ? blocksToSections(career.blocks ?? []) : [],
      },
      {
        title: "Diri Anda di tempat kerja",
        sections: [
          {
            heading: "Cara alami yang membawa hasil",
            body: career?.body ?? undefined,
          },
          {
            heading: "Hal yang perlu diingat dalam berbagai situasi",
            bullets: (partTwo.sceneCautions ?? []).map((item) => ({
              title: item.scene,
              body: item.body,
            })),
          },
          {
            heading: "Hal yang ingin Anda sampaikan kepada rekan kerja",
            bullets: (partTwo.relations ?? []).map((item) => ({
              title: item.relation,
              body: item.body,
            })),
          },
        ],
      },
      {
        title: "Penutup",
        sections: [
          {
            heading: `${type.essence}, pesan yang ingin kami tinggalkan untuk Anda`,
            quote: type.oneLiner,
            body: `Kepribadian Anda bukan daftar hal yang harus diperbaiki, melainkan panduan agar seluruh sifat itu dapat digunakan dengan baik untuk waktu yang lama. Hari ketika ${axis(topAxis).title.toLowerCase()} tampak kuat maupun hari ketika Anda memilih cara berbeda sama-sama merupakan bagian diri Anda yang nyata.\n\nKekuatan Anda sudah bekerja dalam hubungan dan pekerjaan tanpa harus terus dibuktikan. Saat lelah, jangan langsung berusaha lebih keras; perhatikan dulu sinyal apa yang terlewat. Ketika menemukan kembali kecepatan dan jarak yang sesuai, kecenderungan yang sama akan kembali menjadi penopang yang kuat.\n\nLaporan ini tidak menggantikan keputusan Anda. Namun ketika pilihan terasa goyah, laporan ini dapat mengingatkan apa yang Anda hargai dan lingkungan seperti apa yang membuat Anda paling alami. Bukalah kembali kapan pun diperlukan dan temukan kalimat yang sesuai dengan diri Anda saat ini.`,
          },
        ],
      },
    ],
  };
}
