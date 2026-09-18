import type { GapDetailText, GapDir3 } from "@/lib/perception-gap-detail";
import type { BigFiveDimension } from "@/lib/types";

type DirectionCopy = Record<GapDir3, string>;

const AXIS = {
  O: {
    label: "keterbukaan",
    quality: "rasa ingin tahu dan cara Anda melihat kemungkinan baru",
    action: {
      self_lower: "ucapkan satu hal yang membuat Anda penasaran",
      self_higher: "bagikan satu ide yang selama ini tersimpan",
      match: "coba satu pengalaman baru bersama",
    },
  },
  C: {
    label: "ketelitian",
    quality: "cara Anda menata langkah dan menuntaskan tanggung jawab",
    action: {
      self_lower: "serahkan separuh tugas dan percaya pada bantuan mereka",
      self_higher: "ceritakan satu kemajuan yang sudah Anda capai",
      match: "tetapkan satu tujuan kecil bersama",
    },
  },
  E: {
    label: "ekstroversi",
    quality: "energi dan kehangatan Anda saat berhubungan dengan orang lain",
    action: {
      self_lower: "mulailah satu percakapan lebih dulu",
      self_higher: "beri ruang dan tunggu mereka mulai bercerita",
      match: "saling ajak bertemu lagi dengan santai",
    },
  },
  A: {
    label: "keramahan",
    quality: "perhatian dan kepedulian Anda kepada orang lain",
    action: {
      self_lower: "sampaikan satu hal yang benar-benar Anda inginkan",
      self_higher: "ucapkan terima kasih untuk satu hal kecil",
      match: "carilah jalan tengah dan katakan dengan jelas",
    },
  },
  N: {
    label: "kepekaan emosional",
    quality: "kepekaan Anda terhadap perubahan perasaan dan suasana",
    action: {
      self_lower: "ceritakan juga perasaan bahagia Anda dengan jujur",
      self_higher: "bagikan satu kekhawatiran kecil dengan jujur",
      match: "sampaikan perasaan Anda apa adanya",
    },
  },
} satisfies Record<
  BigFiveDimension,
  { label: string; quality: string; action: DirectionCopy }
>;

export function idGapDetail(
  dimension: BigFiveDimension,
  direction: GapDir3,
): GapDetailText {
  const axis = AXIS[dimension];
  if (direction === "self_lower") {
    return {
      full: `${axis.quality[0].toUpperCase()}${axis.quality.slice(1)} terlihat lebih kuat daripada yang Anda sadari. Hal yang terasa biasa bagi Anda ternyata sudah diterima sebagai kekuatan yang nyata.`,
      short: `${axis.quality[0].toUpperCase()}${axis.quality.slice(1)} tampak lebih kuat di mata orang lain daripada dalam penilaian diri Anda.`,
    };
  }
  if (direction === "self_higher") {
    return {
      full: `${axis.quality[0].toUpperCase()}${axis.quality.slice(1)} belum seluruhnya terlihat dari luar. Semakin Anda menunjukkannya lewat satu tindakan kecil, semakin utuh sisi itu akan tersampaikan.`,
      short: `${axis.quality[0].toUpperCase()}${axis.quality.slice(1)} masih menyimpan ruang untuk lebih terlihat dan dipahami.`,
    };
  }
  return {
    full: `${axis.quality[0].toUpperCase()}${axis.quality.slice(1)} diterima hampir sama dengan cara Anda menilai diri sendiri. Keselarasan ini menunjukkan bahwa Anda dapat hadir tanpa perlu melebihkan atau menyembunyikan sisi tersebut.`,
    short: `${axis.quality[0].toUpperCase()}${axis.quality.slice(1)} tersampaikan dengan suhu yang hampir sama seperti penilaian diri Anda.`,
  };
}

export function idRelationFact(
  dimension: BigFiveDimension,
  direction: GapDir3,
): string {
  const axis = AXIS[dimension];
  if (direction === "self_lower") {
    return `Dari lima dimensi, perbedaan terbesar muncul pada ${axis.label}. Angkanya menunjukkan bahwa orang ini melihat ${axis.quality} lebih tinggi daripada penilaian diri Anda. Mungkin ada sisi alami yang hanya lebih mudah muncul ketika kalian bersama.`;
  }
  if (direction === "self_higher") {
    return `Dari lima dimensi, jarak terbesar muncul pada ${axis.label}. Penilaian diri Anda lebih tinggi, sehingga ${axis.quality} belum sepenuhnya terlihat oleh orang ini. Itu juga berarti masih ada banyak sisi diri yang dapat kalian temukan bersama.`;
  }
  return `Di antara lima dimensi, ${axis.label} hampir tidak menunjukkan perbedaan. ${axis.quality[0].toUpperCase()}${axis.quality.slice(1)} diterima dengan angka yang hampir sama oleh kalian berdua. Keselarasan ini adalah tanda bahwa Anda dapat hadir apa adanya dalam hubungan ini.`;
}

export function idRelationNote(
  dimension: BigFiveDimension,
  direction: GapDir3,
): string {
  const axis = AXIS[dimension];
  if (direction === "self_lower") {
    return `${axis.quality[0].toUpperCase()}${axis.quality.slice(1)} sudah sampai lebih jauh daripada yang Anda kira. Itu bukan sekadar penyesuaian, melainkan kualitas alami yang dirasakan sebagai kekuatan. Dengan menerima pandangan ini, hubungan kalian dapat tumbuh semakin setara dan ringan.`;
  }
  if (direction === "self_higher") {
    return `${axis.quality[0].toUpperCase()}${axis.quality.slice(1)} terlihat lebih tenang dari luar daripada yang Anda rasakan di dalam. Mungkin Anda sudah cukup aman untuk tidak selalu memperlihatkan semuanya. Sedikit berbagi akan membuka ruang baru tanpa mengubah kenyamanan yang sudah ada.`;
  }
  return `${axis.quality[0].toUpperCase()}${axis.quality.slice(1)} tersampaikan tanpa dilebihkan ataupun disembunyikan. Kalian berbagi pemahaman yang seimbang tentang sisi ini. Hubungan yang dapat menjaga suhu alami seperti ini biasanya terasa nyaman untuk waktu yang lama.`;
}

export function idRelationTip(
  dimension: BigFiveDimension,
  direction: GapDir3,
): string {
  const action = AXIS[dimension].action[direction];
  return `Saat kalian bertemu lagi, ${action}. Satu langkah konkret itu akan membantu hubungan ini tumbuh lebih dalam tanpa terasa dipaksakan.`;
}

export function idRelationTipKey(
  dimension: BigFiveDimension,
  direction: GapDir3,
): string {
  return AXIS[dimension].action[direction];
}
