import { ID_RESULT_AXES, ID_RESULT_TYPES } from "@/i18n/id/result";
import type { ResolvedDeepDiveSection } from "@/lib/deep-dive-resolve";
import type { MoshimoScene } from "@/lib/moshimo-resolve";
import type { ResolvedPartTwo } from "@/lib/part-two-resolve";
import type { SelfSection } from "@/lib/self-result-content";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

type Scores = Partial<Record<BigFiveDimension, number>>;
type SceneRule = {
  title: string;
  chipLabel: string;
  color: string;
  gated: boolean;
  main: { dim: BigFiveDimension; high: string; low: string };
  spice: { dim: BigFiveDimension; high: string; low: string };
};

const DIMS = ["O", "C", "E", "A", "N"] as const;

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
  return [
    `${description(scores, "N")} Pasangan mungkin diam-diam berusaha memahami kapan Anda membutuhkan kepastian dan kapan Anda hanya perlu ditemani.`,
    `${description(scores, "A")} Karena ingin menjaga hubungan, pasangan bisa menahan hal kecil yang sebenarnya perlu dibicarakan. ${growth(scores, "A")}`,
    `${description(scores, "E")} ${description(scores, "C")} Perbedaan kecepatan, cara membuat rencana, dan frekuensi berkomunikasi dapat terasa sepele bagi Anda tetapi cukup besar bagi pasangan.`,
    "Jika bagian ini terasa sedikit menusuk, tidak apa-apa. Pasangan menahan sesuatu bukan selalu karena cintanya berkurang, melainkan karena hubungan ini penting baginya. Menanyakan ‘akhir-akhir ini bagaimana perasaanmu?’ dapat mengubah beban yang dipendam menjadi kepercayaan.",
  ].join("\n\n");
}

function idCareerRelations(scores: Scores) {
  return [
    `${description(scores, "E")} Di tempat kerja, cara Anda mengatur jarak dengan orang lain sangat memengaruhi kesan pertama dan alur kerja tim.`,
    `${description(scores, "A")} ${growth(scores, "A")} Kejujuran dan keramahan sama-sama berguna ketika disampaikan pada waktu yang tepat.`,
    `${description(scores, "N")} ${description(scores, "C")} Tekanan paling mudah muncul ketika standar, ritme, dan ekspektasi tidak dibicarakan sejak awal.`,
    "Kebiasaan dalam hubungan kerja bukan sesuatu yang harus dihapus, melainkan perlu ditempatkan di lingkungan yang tepat. Tim yang menghargai cara Anda berkomunikasi akan membuat kemampuan Anda terlihat tanpa memaksa Anda menjadi orang lain.",
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
  const loveBlocks = [
    {
      heading: "Daya tarik Anda dalam cinta",
      body: `${type.oneLiner}\n\n${strength(scores, "A")} ${description(scores, "E")}\n\n${description(scores, "N")} Inilah alasan perhatian dan cara Anda mendekat terasa khas bagi orang yang menyukai Anda.`,
      locked: false,
    },
    gate(
      "Panduan bagi orang yang menyukai Anda",
      `${description(scores, "N")}\n\n${growth(scores, "A")} ${growth(scores, "E")}\n\nHubungan dengan Anda berkembang ketika perhatian tidak hanya ditebak, tetapi juga dinyatakan lewat kata-kata dan tindakan yang konsisten.`,
    ),
    gate(
      "Hal yang mungkin diam-diam ditahan pasangan",
      idLoveEndure(scores),
    ),
  ];
  const careerBlocks = [
    {
      heading: "Cara Anda bekerja",
      body: `${strength(scores, "C")} ${description(scores, "O")}\n\n${type.oneLiner} Dalam pekerjaan, ciri ini terlihat dari cara Anda memilih prioritas, menjaga kualitas, dan merespons perubahan.`,
      locked: false,
    },
    gate(
      "Gaya kerja yang cocok dan lingkungan yang perlu dihindari",
      `${strength(scores, "O")} ${growth(scores, "C")} Lingkungan terbaik memberi tujuan yang jelas sekaligus cukup ruang untuk menggunakan cara kerja Anda sendiri.`,
    ),
    gate("Hubungan di tempat kerja", idCareerRelations(scores)),
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
  return [
    `${description(scores, "E")} Cara ini membuat orang lain merasa dapat mendekati Anda dengan ritme yang alami.`,
    `${strength(scores, "A")} ${strength(scores, "C")}`,
    `${strength(scores, "O")} ${strength(scores, "N")}`,
    "Anda mungkin tidak selalu menyadarinya, tetapi kombinasi ini sangat disukai orang lain. Anda tidak perlu melebih-lebihkan diri; versi Anda yang biasa sudah memiliki daya tarik yang jelas.",
  ];
}

function idRelations(scores: Scores) {
  return [
    { relation: "Dari sudut pandang teman", body: `${description(scores, "E")} ${strength(scores, "A")} Teman cenderung mengingat cara Anda membuat kebersamaan terasa lebih mudah.` },
    { relation: "Dari sudut pandang pasangan", body: `${description(scores, "N")} ${growth(scores, "A")} Pasangan akan merasa lebih aman ketika kebutuhan dan perasaan dibicarakan secara langsung.` },
    { relation: "Dari sudut pandang keluarga", body: `${description(scores, "A")} ${growth(scores, "C")} Keluarga dapat melihat sisi Anda yang lebih santai daripada orang di luar rumah.` },
    { relation: "Dari sudut pandang atasan atau senior", body: `${description(scores, "C")} ${strength(scores, "O")} Anda paling dipercaya ketika kemajuan dan cara berpikir Anda terlihat jelas.` },
  ];
}

function idSceneCautions(scores: Scores) {
  return [
    { scene: "Saat bersama teman", body: `${growth(scores, "E")} ${growth(scores, "A")} Jangan biarkan keinginan menjaga suasana membuat kebutuhan Anda sendiri tidak terlihat.` },
    { scene: "Saat bersama pasangan", body: `${growth(scores, "N")} ${growth(scores, "A")} Sampaikan ketidaknyamanan ketika masih kecil agar tidak berubah menjadi kesimpulan sepihak.` },
    { scene: "Dalam karier", body: `${growth(scores, "C")} ${growth(scores, "N")} Tentukan batas ‘cukup baik’ sebelum tekanan membuat pekerjaan terasa lebih berat dari yang sebenarnya.` },
    { scene: "Saat bersama keluarga", body: `${growth(scores, "A")} ${growth(scores, "E")} Orang terdekat tetap membutuhkan penjelasan, meskipun Anda merasa mereka seharusnya sudah memahami Anda.` },
  ];
}

export function buildIdPartTwo(
  typeId: ThirtyTwoTypeId,
  scores: Scores,
  unlocked: boolean,
): ResolvedPartTwo {
  const type = ID_RESULT_TYPES[typeId];
  const [top] = rankedDimensions(scores);
  return {
    likable: idLikable(scores),
    weapons: [
      { title: "Kekuatan khas Anda", body: type.oneLiner },
      ...DIMS.map((dim) => ({ title: `Kekuatan ${axis(dim).title}`, body: strength(scores, dim) })),
    ],
    dislikable: unlocked
      ? [
          { title: "Saat kekuatan khas Anda disalahpahami", body: `${type.oneLiner} Namun, ketika muncul terlalu kuat, orang lain mungkin membutuhkan penjelasan tentang maksud Anda.` },
          ...DIMS.map((dim) => ({ title: `Saat ${axis(dim).title.toLowerCase()} disalahpahami`, body: growth(scores, dim) })),
        ]
      : null,
    relations: unlocked ? idRelations(scores) : null,
    sceneCautions: unlocked ? idSceneCautions(scores) : null,
    gapTeaser: `Sisi “${axis(top).title}” yang terasa paling kuat bagi Anda mungkin terlihat dengan intensitas berbeda di mata teman.`,
    locked: !unlocked,
  };
}

const SCENES: readonly SceneRule[] = [
  { title: "Saat foto bersama", chipLabel: "Foto bersama", color: "#F48BAE", gated: true, main: { dim: "E", high: "Anda secara alami berada dekat tengah dan mencairkan suasana tepat sebelum kamera mengambil gambar.", low: "Anda memilih tempat nyaman di pinggir dan justru menghasilkan ekspresi paling alami." }, spice: { dim: "C", high: "Anda juga memastikan tidak ada seorang pun yang terpotong dari foto.", low: "Anda bisa begitu menikmati momennya sampai lupa menyimpan fotonya." } },
  { title: "Saat lebah masuk ke ruangan", chipLabel: "Ada lebah", color: "#4CAF7D", gated: false, main: { dim: "E", high: "Anda bereaksi paling dulu, lalu entah bagaimana menjadi orang yang membuka jendela dan mengatur penyelamatan.", low: "Anda diam, mengamati pergerakannya, dan percaya bahwa tidak menarik perhatian adalah strategi teraman." }, spice: { dim: "N", high: "Bahkan setelah lebah pergi, sebagian perhatian Anda tetap tertuju ke jendela.", low: "Begitu bahaya berlalu, Anda kembali beraktivitas dengan ketenangan yang mengesankan." } },
  { title: "Saat lift berhenti mendadak", chipLabel: "Lift berhenti", color: "#56BFE8", gated: false, main: { dim: "C", high: "Anda memeriksa panel dan tombol darurat lalu menjalankan langkah praktis secara berurutan.", low: "Anda mencari sinyal, membaca suasana, dan menyesuaikan diri dengan informasi yang tersedia." }, spice: { dim: "A", high: "Anda mungkin menenangkan penumpang lain sebelum membicarakan kekhawatiran sendiri.", low: "Anda tidak memaksakan kata-kata penghiburan, tetapi sikap tenang Anda tetap membantu." } },
  { title: "Saat sesuatu terasa tidak beres di minimarket", chipLabel: "Terasa tidak beres", color: "#F2C14E", gated: false, main: { dim: "N", high: "Anda menangkap perubahan suasana sebelum kebanyakan orang dapat menjelaskan apa yang berbeda.", low: "Anda tetap tenang sambil menunggu fakta yang cukup untuk memahami situasi." }, spice: { dim: "C", high: "Anda diam-diam memastikan letak pintu keluar dan memilih langkah yang paling aman.", low: "Anda mengandalkan intuisi cepat yang sering cukup akurat ketika tidak ada waktu menyusun rencana." } },
  { title: "Saat listrik tiba-tiba padam", chipLabel: "Listrik padam", color: "#56BFE8", gated: false, main: { dim: "E", high: "Reaksi Anda menjadi bagian dari suasana ruangan dan membantu mengubah kepanikan menjadi momen bersama.", low: "Saat orang lain bereaksi, Anda diam-diam menyalakan penerangan dan langsung berguna." }, spice: { dim: "O", high: "Pikiran Anda segera membayangkan kemungkinan baru yang muncul dari gangguan ini.", low: "Anda mulai memperkirakan berapa lama gangguan berlangsung dan apa yang masih perlu dilakukan." } },
  { title: "Saat menghadapi orang yang agresif", chipLabel: "Situasi tegang", color: "#F48BAE", gated: true, main: { dim: "A", high: "Nada tenang Anda dapat meredakan situasi sebelum berkembang lebih jauh.", low: "Anda bersikap tegas dan tidak memberi reaksi yang sedang dipancing." }, spice: { dim: "E", high: "Anda cepat mengeluarkan teman dari situasi sambil mengalihkan perhatian kepada diri sendiri.", low: "Anda mengurangi kehadiran, mengutamakan keselamatan, dan pergi tanpa menjadikannya pertarungan." } },
  { title: "Saat rencana dibatalkan mendadak", chipLabel: "Batal mendadak", color: "#4CAF7D", gated: true, main: { dim: "N", high: "Untuk sesaat, Anda meninjau percakapan dan bertanya-tanya apakah ada tanda yang terlewat.", low: "Anda menerima perubahan dengan cepat dan siap menjadwalkan ulang sebelum permintaan maaf selesai." }, spice: { dim: "O", high: "Waktu kosong itu segera berubah menjadi kesempatan membuat rencana baru.", low: "Anda mengembalikan ritme hari dengan rutinitas yang sudah akrab dan dapat diandalkan." } },
  { title: "Jika terdampar di pulau terpencil", chipLabel: "Pulau terpencil", color: "#F2C14E", gated: true, main: { dim: "C", high: "Anda menyusun prioritas air, tempat berlindung, dan makanan sebelum menghabiskan tenaga.", low: "Anda menjelajah, membaca kondisi pulau, dan membangun rencana dari apa yang benar-benar tersedia." }, spice: { dim: "A", high: "Jika ada orang lain, Anda memeriksa keadaan mereka dan menjadi penyangga emosi kelompok.", low: "Anda nyaman menjelajah sendiri dan mungkin memetakan lebih banyak wilayah dari dugaan orang lain." } },
  { title: "Saat memenangkan uang dalam jumlah besar", chipLabel: "Menang undian", color: "#4CAF7D", gated: true, main: { dim: "C", high: "Sebelum merayakan, Anda membagi uang untuk keamanan, tanggung jawab, dan kesenangan.", low: "Anda menciptakan satu kenangan besar lebih dulu lalu mengatur rinciannya kemudian." }, spice: { dim: "E", high: "Anda berniat merahasiakannya, tetapi kegembiraan mungkin sampai kepada seorang teman tepercaya.", low: "Anda dapat menjalani hari biasa dengan begitu tenang hingga tidak seorang pun curiga." } },
  { title: "Saat orang asing memasuki sekolah atau kantor", chipLabel: "Penyusup", color: "#F48BAE", gated: true, main: { dim: "E", high: "Anda segera memberi tahu orang di sekitar dan tanpa sadar bergerak di depan untuk memandu evakuasi.", low: "Pikiran Anda bergerak sebelum suara keluar; Anda memeriksa jalur keluar lalu memberi isyarat tenang kepada orang terdekat." }, spice: { dim: "N", high: "Kemungkinan besar, Anda juga orang pertama yang menyadari bahwa suasananya terasa tidak biasa.", low: "Ketenangan Anda membuat orang lain heran karena Anda tetap dapat bertindak tanpa menambah kepanikan." } },
  { title: "Satu minggu sebelum ujian penting", chipLabel: "Sebelum ujian", color: "#56BFE8", gated: true, main: { dim: "C", high: "Rencana sudah tersusun dan kemajuan yang terlihat membuat minggu terakhir terasa terkendali.", low: "Anda menjaga tekanan tetap ringan lalu mengerahkan fokus kuat ketika tugas terasa nyata." }, spice: { dim: "N", high: "Anda mungkin belajar lebih banyak dari siapa pun tetapi tetap merasa ada satu hal penting yang belum dikuasai.", low: "Ketenangan Anda membantu tidur nyenyak ketika orang lain masih menulis ulang catatan." } },
  { title: "Saat ketinggalan kendaraan terakhir", chipLabel: "Ketinggalan kereta", color: "#F2C14E", gated: true, main: { dim: "O", high: "Anda mengubah masalah menjadi petualangan kecil dan mencari pilihan paling menarik yang masih masuk akal.", low: "Anda membandingkan rute, harga, dan waktu hingga solusi paling praktis terlihat jelas." }, spice: { dim: "A", high: "Anda mungkin memastikan cara pulang orang lain sebelum menyelesaikan masalah sendiri.", low: "Anda memilih pilihan yang paling masuk akal dan menyampaikannya tanpa menambah drama." } },
];

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
