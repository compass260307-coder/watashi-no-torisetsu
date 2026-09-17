import { ID_RESULT_AXES, ID_RESULT_TYPES } from "@/i18n/id/result";
import type { ResolvedDeepDiveSection } from "@/lib/deep-dive-resolve";
import type { MoshimoScene } from "@/lib/moshimo-resolve";
import type { ResolvedPartTwo } from "@/lib/part-two-resolve";
import type { SelfSection } from "@/lib/self-result-content";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

type Scores = Partial<Record<BigFiveDimension, number>>;

function axis(dim: BigFiveDimension) {
  const value = ID_RESULT_AXES.find((item) => item.dim === dim);
  if (!value) throw new Error(`Unknown Big Five dimension: ${dim}`);
  return value;
}

function high(scores: Scores, dim: BigFiveDimension) {
  return (scores[dim] ?? 5) >= 5;
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

export function buildIdSelfSections(typeId: ThirtyTwoTypeId, scores: Scores): SelfSection[] {
  const type = ID_RESULT_TYPES[typeId];
  return [
    {
      title: "Panduan diri Anda",
      heading: "Cara alami Anda bergerak di dunia",
      body: `${type.oneLiner}\n\n${description(scores, "O")} ${description(scores, "C")}\n\n${description(scores, "E")} ${description(scores, "A")} ${description(scores, "N")}`,
    },
    {
      title: "Hal yang perlu diperhatikan",
      heading: "Pola yang layak Anda sadari",
      body: `${growth(scores, "N")}\n\n${growth(scores, "C")} ${growth(scores, "A")}\n\n${growth(scores, "O")} ${growth(scores, "E")}`,
    },
    {
      title: "Pasangan yang cocok",
      heading: "Orang yang membantu Anda menjadi versi terbaik",
      body: `Anda cenderung merasa nyaman dengan orang yang menghargai ritme dan cara berpikir Anda. ${description(scores, "A")}\n\nHubungan terasa paling sehat ketika kedua pihak dapat berbicara jujur, memberi ruang, dan berbagi tanggung jawab. ${growth(scores, "E")}`,
    },
  ];
}

export function buildIdDeepDiveSections(typeId: ThirtyTwoTypeId, scores: Scores, unlocked: boolean): ResolvedDeepDiveSection[] {
  const type = ID_RESULT_TYPES[typeId];
  const lockedBlock = (heading: string, body: string) => unlocked ? { heading, body } : { heading, body: "", locked: true };
  const loveBlocks = [
    { heading: "Daya tarik Anda dalam cinta", body: `${type.oneLiner}\n\n${strength(scores, "A")} ${description(scores, "E")}`, locked: false },
    lockedBlock("Panduan bagi orang yang menyukai Anda", `${description(scores, "N")} ${growth(scores, "A")} ${growth(scores, "E")}`),
    lockedBlock("Hal yang mungkin diam-diam ditahan pasangan", `${growth(scores, "N")} ${growth(scores, "C")}`),
  ];
  const careerBlocks = [
    { heading: "Cara Anda bekerja", body: `${strength(scores, "C")} ${description(scores, "O")}`, locked: false },
    lockedBlock("Gaya kerja yang cocok dan lingkungan yang perlu dihindari", `${strength(scores, "O")} ${growth(scores, "C")}`),
    lockedBlock("Hubungan di tempat kerja", `${description(scores, "E")} ${description(scores, "A")} ${growth(scores, "N")}`),
  ];
  return [
    { key: "love", tab: "Kecenderungan dalam cinta", note: "Melihat lebih dekat hubungan, kepercayaan, dan ritme emosi Anda.", body: loveBlocks.filter((item) => !item.locked).map((item) => item.body).join("\n\n"), blocks: loveBlocks, locked: false },
    { key: "career", tab: "Karier dan pertumbuhan", note: "Lingkungan tempat kekuatan Anda dapat berkembang.", body: careerBlocks.filter((item) => !item.locked).map((item) => item.body).join("\n\n"), blocks: careerBlocks, locked: false },
  ];
}

export function buildIdPartTwo(typeId: ThirtyTwoTypeId, scores: Scores, unlocked: boolean): ResolvedPartTwo {
  const type = ID_RESULT_TYPES[typeId];
  const weapons = (["O", "C", "E", "A", "N"] as BigFiveDimension[]).map((dim) => ({ title: `Kekuatan ${axis(dim).title}`, body: strength(scores, dim) }));
  weapons.unshift({ title: "Kekuatan khas Anda", body: type.oneLiner });
  return {
    likable: [strength(scores, "A"), strength(scores, "E"), strength(scores, "N")],
    weapons,
    dislikable: unlocked ? (["O", "C", "E", "A", "N"] as BigFiveDimension[]).map((dim) => ({ title: `Saat ${axis(dim).title.toLowerCase()} disalahpahami`, body: growth(scores, dim) })) : null,
    relations: unlocked ? [
      { relation: "Dengan teman", body: `${description(scores, "E")} ${strength(scores, "A")}` },
      { relation: "Dengan pasangan", body: `${description(scores, "N")} ${growth(scores, "A")}` },
      { relation: "Dengan keluarga", body: `${description(scores, "A")} ${growth(scores, "C")}` },
      { relation: "Di tempat kerja", body: `${description(scores, "C")} ${strength(scores, "O")}` },
    ] : null,
    sceneCautions: unlocked ? [
      { scene: "Dengan teman", body: growth(scores, "E") },
      { scene: "Dengan pasangan", body: growth(scores, "N") },
      { scene: "Dalam karier", body: growth(scores, "C") },
      { scene: "Dengan keluarga", body: growth(scores, "A") },
    ] : null,
    gapTeaser: "Teman mungkin melihat kekuatan dan kebiasaan yang terasa biasa saja bagi Anda.",
    locked: !unlocked,
  };
}

const SCENES: readonly { title: string; chipLabel: string; color: string; gated: boolean; dim: BigFiveDimension; high: string; low: string }[] = [
  { title: "Saat foto bersama", chipLabel: "Foto bersama", color: "#F48BAE", gated: true, dim: "E", high: "Anda mencairkan suasana dan membantu semua orang tampil alami di depan kamera.", low: "Anda memilih tempat yang nyaman dan justru menghasilkan ekspresi paling alami." },
  { title: "Saat lebah masuk ke ruangan", chipLabel: "Ada lebah", color: "#4CAF7D", gated: false, dim: "N", high: "Anda segera menyadari pergerakannya dan tetap waspada sampai situasi benar-benar aman.", low: "Anda tetap tenang, membuka jalan keluar, lalu kembali pada kegiatan semula." },
  { title: "Saat lift berhenti mendadak", chipLabel: "Lift berhenti", color: "#56BFE8", gated: false, dim: "C", high: "Anda memeriksa panel dan tombol darurat lalu menjalankan langkah praktis secara berurutan.", low: "Anda mencari sinyal, membaca suasana, dan menyesuaikan diri dengan informasi yang tersedia." },
  { title: "Saat sesuatu terasa tidak beres di minimarket", chipLabel: "Terasa tidak beres", color: "#F2C14E", gated: false, dim: "N", high: "Anda menangkap perubahan suasana lebih cepat daripada kebanyakan orang.", low: "Anda tetap tenang sambil menunggu fakta yang cukup sebelum bertindak." },
  { title: "Saat listrik tiba-tiba padam", chipLabel: "Listrik padam", color: "#56BFE8", gated: false, dim: "E", high: "Energi Anda membantu mengubah kepanikan menjadi momen yang bisa dihadapi bersama.", low: "Anda diam-diam menyalakan penerangan dan menjadi berguna tanpa perlu mengumumkannya." },
  { title: "Saat menghadapi orang yang agresif", chipLabel: "Situasi tegang", color: "#F48BAE", gated: true, dim: "A", high: "Nada tenang Anda dapat meredakan situasi sebelum membesar.", low: "Anda menjaga sikap tegas dan tidak memberi reaksi yang sedang dipancing." },
  { title: "Saat rencana dibatalkan mendadak", chipLabel: "Batal mendadak", color: "#4CAF7D", gated: true, dim: "N", high: "Anda sempat memeriksa kembali percakapan untuk memahami apa yang berubah.", low: "Anda menerima perubahan dengan cepat dan segera menyiapkan rencana lain." },
  { title: "Jika terdampar di pulau terpencil", chipLabel: "Pulau terpencil", color: "#F2C14E", gated: true, dim: "C", high: "Anda menyusun prioritas air, tempat berlindung, dan makanan sebelum menghabiskan tenaga.", low: "Anda menjelajah dan membangun rencana berdasarkan apa yang benar-benar tersedia." },
  { title: "Saat memenangkan uang dalam jumlah besar", chipLabel: "Menang undian", color: "#4CAF7D", gated: true, dim: "C", high: "Anda membagi uang untuk keamanan, tanggung jawab, dan kesenangan sebelum merayakan.", low: "Anda menciptakan satu kenangan besar lebih dulu lalu mengatur rinciannya kemudian." },
  { title: "Saat orang asing memasuki sekolah atau kantor", chipLabel: "Penyusup", color: "#F48BAE", gated: true, dim: "N", high: "Anda cepat menangkap tanda yang tidak biasa dan mencari jalur paling aman.", low: "Anda tetap berfungsi, menunggu informasi tepercaya, dan tidak menyebarkan kepanikan." },
  { title: "Satu minggu sebelum ujian penting", chipLabel: "Sebelum ujian", color: "#56BFE8", gated: true, dim: "C", high: "Rencana sudah tersusun dan kemajuan yang terlihat membuat minggu terakhir terasa terkendali.", low: "Anda menjaga tekanan tetap ringan lalu mengerahkan fokus kuat saat tugas terasa nyata." },
  { title: "Saat ketinggalan kendaraan terakhir", chipLabel: "Ketinggalan kereta", color: "#F2C14E", gated: true, dim: "O", high: "Anda mengubah masalah menjadi petualangan kecil dan mencari pilihan yang paling menarik sekaligus masuk akal.", low: "Anda membandingkan rute, harga, dan waktu hingga solusi paling praktis terlihat jelas." },
];

export function buildIdMoshimoScenes(scores: Scores, unlocked: boolean): MoshimoScene[] {
  return SCENES.map((scene) => ({ title: scene.title, chipLabel: scene.chipLabel, color: scene.color, body: scene.gated && !unlocked ? "" : high(scores, scene.dim) ? scene.high : scene.low, locked: scene.gated && !unlocked }));
}
