export const ID_ARTICLE_CATEGORIES = [
  "Dasar-dasar",
  "Pemahaman diri",
  "Teman dan hubungan",
] as const;

export type IdArticleCategory = (typeof ID_ARTICLE_CATEGORIES)[number];
export type IdArticleSection = {
  heading: string;
  paragraphs: string[];
  list?: { term: string; body: string }[];
};
export type IdArticle = {
  slug: string;
  title: string;
  listTitle: string;
  description: string;
  category: IdArticleCategory;
  published: string;
  updated?: string;
  image: string;
  imageAlt: string;
  lead: string[];
  sections: IdArticleSection[];
};

type FactorInput = {
  slug: string;
  letter: string;
  factor: string;
  question: string;
  description: string;
  image: string;
  imageAlt: string;
  high: { term: string; body: string }[];
  low: { term: string; body: string }[];
  misconception: string;
  practice: string;
};

function factorArticle(input: FactorInput): IdArticle {
  return {
    slug: input.slug,
    title: `Apa itu ${input.factor} (${input.letter}) dalam Big Five? ${input.question}`,
    listTitle: `${input.factor} (${input.letter}): ${input.question}`,
    description: input.description,
    category: "Pemahaman diri",
    published: "2026-07-21",
    image: input.image,
    imageAlt: input.imageAlt,
    lead: [
      `${input.factor} adalah salah satu dari lima dimensi dalam model Big Five atau OCEAN. Dimensi ini menggambarkan kecenderungan, bukan identitas tetap atau ukuran nilai diri.`,
      "Skor tinggi maupun rendah dapat berguna dalam situasi yang berbeda. Memahami kekuatan dan konsekuensinya membuat hasil lebih praktis dan tidak menghakimi.",
    ],
    sections: [
      { heading: `Ciri umum skor ${input.factor} yang lebih tinggi`, paragraphs: ["Skor yang lebih tinggi cenderung terlihat melalui pola berikut."], list: input.high },
      { heading: `Ciri umum skor ${input.factor} yang lebih rendah`, paragraphs: ["Skor yang lebih rendah cenderung terlihat melalui pola berikut."], list: input.low },
      { heading: "Kesalahpahaman yang umum", paragraphs: [input.misconception] },
      { heading: `Memahami ${input.factor} Anda`, paragraphs: [input.practice] },
    ],
  };
}

export const ID_ARTICLES: IdArticle[] = [
  {
    slug: "ocean-shindan",
    title: "Apa itu tes kepribadian OCEAN? Panduan jelas tentang lima sifat Big Five",
    listTitle: "Apa itu tes kepribadian OCEAN?",
    description: "Kenali Openness, Conscientiousness, Extraversion, Agreeableness, dan Neuroticism serta perbedaannya dari tes berbasis tipe.",
    category: "Dasar-dasar",
    published: "2026-07-21",
    image: "/mascot/diagnosis-hero.png",
    imageAlt: "Karakter Alice Personalities mengerjakan tes kepribadian",
    lead: [
      "Tes OCEAN didasarkan pada Big Five, salah satu kerangka kepribadian yang paling banyak diteliti. Kepribadian digambarkan sebagai pola pada lima dimensi berkelanjutan.",
      "Panduan ini menjelaskan kelima sifat, perbedaan antara dimensi dan tipe, serta manfaat sudut pandang teman.",
    ],
    sections: [
      { heading: "Apa arti OCEAN?", paragraphs: ["OCEAN adalah singkatan dari Openness, Conscientiousness, Extraversion, Agreeableness, dan Neuroticism. Setiap orang memiliki posisi pada kelima spektrum tersebut.", "Model ini tidak memasukkan semua orang ke satu kotak. Seseorang dapat sangat teliti, cukup ekstrover, dan berada di tengah pada keterbukaan."] },
      { heading: "Lima dimensi kepribadian", paragraphs: ["Tidak ada ujung spektrum yang selalu lebih baik. Setiap kecenderungan membawa kekuatan dan konsekuensi sesuai situasi."], list: [
        { term: "Keterbukaan (O)", body: "Keingintahuan terhadap ide, pengalaman, imajinasi, dan perubahan." },
        { term: "Ketelitian (C)", body: "Kecenderungan merencanakan, menjaga struktur, dan menuntaskan komitmen." },
        { term: "Ekstroversi (E)", body: "Kecenderungan memperoleh energi dari stimulasi dan interaksi sosial." },
        { term: "Keramahan (A)", body: "Perhatian pada kerja sama, kepercayaan, dan kebutuhan orang lain." },
        { term: "Neurotisisme (N)", body: "Kepekaan terhadap emosi, ancaman, tekanan, dan ketidakpastian." },
      ] },
      { heading: "Berbeda dari tes 16 tipe", paragraphs: ["Tes 16 tipe menggabungkan pilihan biner menjadi kategori yang mudah diingat. OCEAN mempertahankan skor berkelanjutan agar nuansa di dekat titik tengah tidak hilang.", "Alice Personalities mengukur lima dimensi OCEAN lalu merangkum polanya menjadi satu dari 32 karakter."] },
      { heading: "Seberapa andal hasil OCEAN?", paragraphs: ["Struktur lima faktor telah diteliti selama puluhan tahun dalam banyak bahasa dan budaya. Namun, laporan diri tetap dipengaruhi suasana, konteks, dan pemahaman pertanyaan, sehingga hasil sebaiknya dipakai sebagai peta saat ini, bukan vonis permanen."] },
      { heading: "Teman dapat melihat sisi yang luput dari diri sendiri", paragraphs: ["Orang lain mengamati perilaku Anda dari sudut berbeda. Kebiasaan yang terasa biasa bagi Anda mungkin justru menjadi kualitas yang paling mereka andalkan.", "Perbedaan antara penilaian diri dan teman bukan selalu kesalahan; perbedaan itu dapat menunjukkan jarak antara niat, perilaku, dan dampak."] },
    ],
  },
  {
    slug: "sixteen-types-vs-ocean",
    title: "OCEAN vs. tes 16 tipe: apa bedanya dan mana yang lebih akurat?",
    listTitle: "OCEAN vs. tes 16 tipe",
    description: "Bandingkan tes berbasis tipe dengan model Big Five yang berkelanjutan, termasuk kekuatan dan keterbatasannya.",
    category: "Dasar-dasar", published: "2026-07-21", image: "/characters/v3/hawk_R.webp", imageAlt: "Karakter elang membandingkan kerangka kepribadian",
    lead: ["Tes berbasis tipe dan OCEAN sama-sama membantu membicarakan kepribadian, tetapi keduanya menjawab pertanyaan dengan cara berbeda.", "Perbedaan terpenting adalah kategori versus dimensi berkelanjutan dan tujuan penggunaan hasilnya."],
    sections: [
      { heading: "Perbedaan terbesar: kotak atau gradasi", paragraphs: ["Sistem tipe menggambar batas dan memberi nama pada kombinasi. OCEAN mengukur lima gradasi terpisah sehingga perbedaan tingkat tetap terlihat."] },
      { heading: "Kekuatan dan batas 16 tipe", paragraphs: ["Tipe mudah diingat, menyenangkan dibagikan, dan cepat memicu refleksi. Namun, batas kategori dapat membesar-besarkan perbedaan kecil di dekat titik tengah."] },
      { heading: "Kekuatan dan batas OCEAN", paragraphs: ["Skor berkelanjutan mempertahankan nuansa dan kuat untuk penelitian. Angka saja bisa terasa abstrak dan kurang mudah dibicarakan."] },
      { heading: "Akurasi dan pengalaman yang menyenangkan dapat digabungkan", paragraphs: ["Alice Personalities memakai skor OCEAN sebagai dasar lalu menghadirkannya melalui 32 karakter. Karakter merangkum hasil, bukan menggantikan lima skor di bawahnya."] },
    ],
  },
  factorArticle({ slug: "kaihousei", letter: "O", factor: "Keterbukaan", question: "penjelasan skor tinggi dan rendah", description: "Pahami keingintahuan, imajinasi, kebaruan, kepraktisan, dan rutinitas yang tepercaya.", image: "/characters/v3/unicorn_N.webp", imageAlt: "Karakter unicorn yang mewakili keterbukaan", high: [{ term: "Keingintahuan", body: "Anda senang menjelajahi ide sebelum tahu apakah ide itu berguna." }, { term: "Imajinasi", body: "Kemungkinan dan masa depan alternatif terasa alami." }, { term: "Nyaman dengan perubahan", body: "Variasi dapat memberi energi." }], low: [{ term: "Penilaian praktis", body: "Anda memilih ide yang bekerja dalam kehidupan nyata." }, { term: "Konsistensi", body: "Rutinitas membebaskan perhatian untuk eksekusi." }, { term: "Kedalaman melalui pengulangan", body: "Anda menyempurnakan cara yang sudah terbukti." }], misconception: "Keterbukaan rendah bukan berarti kurang cerdas atau kreatif. Keterbukaan tinggi juga tidak selalu lebih baik; terlalu banyak kebaruan dapat menyulitkan komitmen.", practice: "Perhatikan apakah Anda paling hidup saat menemukan kemungkinan baru atau memperbaiki sesuatu yang sudah mapan." }),
  factorArticle({ slug: "seijitsusei", letter: "C", factor: "Ketelitian", question: "penjelasan skor tinggi dan rendah", description: "Pelajari hubungan ketelitian dengan perencanaan, tindak lanjut, fleksibilitas, dan tujuan.", image: "/characters/v3/bear_R.webp", imageAlt: "Karakter beruang yang mewakili ketelitian", high: [{ term: "Perencanaan", body: "Anda mengurangi ketidakpastian dengan menentukan urutan." }, { term: "Tindak lanjut", body: "Komitmen tetap terlihat setelah semangat awal mereda." }, { term: "Standar", body: "Ketepatan menjadi bagian dari cara membangun kepercayaan." }], low: [{ term: "Fleksibilitas", body: "Anda mudah menyesuaikan arah ketika keadaan berubah." }, { term: "Mulai cepat", body: "Anda dapat bertindak ketika orang lain masih mengatur." }, { term: "Improvisasi", body: "Keterbatasan tak terduga memunculkan solusi kreatif." }], misconception: "Ketelitian rendah tidak sama dengan malas, dan ketelitian tinggi tidak menjamin efektivitas. Struktur berguna ketika melayani tujuan.", practice: "Lihat cara Anda menghadapi tenggat biasa: apakah rencana atau ruang improvisasi yang membuat usaha lebih mudah dipertahankan?" }),
  factorArticle({ slug: "gaikousei", letter: "E", factor: "Ekstroversi", question: "apakah introvert itu buruk?", description: "Lihat ekstroversi sebagai perbedaan energi dan stimulasi, bukan penilaian atas kepercayaan diri.", image: "/characters/v3/dolphin_R.webp", imageAlt: "Karakter lumba-lumba yang mewakili ekstroversi", high: [{ term: "Energi sosial", body: "Percakapan dan aktivitas bersama dapat mengisi energi." }, { term: "Inisiatif", body: "Anda cepat masuk ke situasi dan berpikir sambil berbicara." }, { term: "Ekspresivitas", body: "Antusiasme Anda mudah terlihat." }], low: [{ term: "Fokus mendalam", body: "Kesendirian mendukung perhatian yang berkelanjutan." }, { term: "Hubungan selektif", body: "Beberapa hubungan mendalam terasa lebih kaya." }, { term: "Observasi", body: "Anda membaca suasana sebelum masuk." }], misconception: "Introversi bukan rasa malu atau kemampuan komunikasi yang buruk. Ekstroversi juga bukan kedangkalan; energi yang terlihat dapat membantu kelompok bergerak.", practice: "Perhatikan apa yang memulihkan Anda setelah minggu yang berat: lebih banyak interaksi atau lebih sedikit rangsangan." }),
  factorArticle({ slug: "kyouchousei", letter: "A", factor: "Keramahan", question: "penjelasan skor tinggi dan rendah", description: "Pahami kerja sama, empati, keterusterangan, batas, dan negosiasi.", image: "/characters/v3/angel_N.webp", imageAlt: "Karakter malaikat yang mewakili keramahan", high: [{ term: "Empati", body: "Anda memikirkan dampak emosional sebuah keputusan." }, { term: "Kerja sama", body: "Anda mencari solusi yang menjaga hubungan." }, { term: "Kepercayaan", body: "Anda memulai dari niat baik." }], low: [{ term: "Keterusterangan", body: "Anda menyebut masalah tanpa terlalu banyak pelapis." }, { term: "Negosiasi", body: "Kepentingan yang bersaing tidak otomatis membuat Anda tidak nyaman." }, { term: "Penilaian mandiri", body: "Anda dapat berbeda pendapat dan tetap berpikir jernih." }], misconception: "Skor lebih rendah tidak membuat seseorang tidak baik, dan skor tinggi tidak membuat semua keputusan adil. Kerja sama membutuhkan batas; keterusterangan membutuhkan kepedulian.", practice: "Ingat perselisihan terakhir: apakah Anda melindungi harmoni atau kejelasan lebih dulu?" }),
  factorArticle({ slug: "shinkeisho-keiko", letter: "N", factor: "Neurotisisme", question: "bagaimana kepekaan menjadi kekuatan", description: "Pelajari kepekaan emosional dan kestabilan serta cara memakai sinyal emosi tanpa kewalahan.", image: "/characters/v3/rabbit_N.webp", imageAlt: "Karakter kelinci yang mewakili kepekaan emosional", high: [{ term: "Peringatan dini", body: "Anda mungkin melihat risiko sebelum orang lain." }, { term: "Nuansa emosi", body: "Perubahan kecil pada nada membawa informasi." }, { term: "Persiapan", body: "Antisipasi mendorong rencana cadangan." }], low: [{ term: "Ketenangan", body: "Stres lebih jarang mengambil alih perhatian." }, { term: "Pemulihan", body: "Kegagalan meninggalkan jejak emosi yang lebih ringan." }, { term: "Toleransi ketidakpastian", body: "Anda tetap bergerak tanpa menyelesaikan semua risiko." }], misconception: "Skor tinggi bukan kelemahan; kepekaan mendukung empati dan pandangan ke depan. Skor rendah bukan ketidakpedulian.", practice: "Perlakukan kepekaan sebagai sinyal, bukan perintah: beri nama perasaan, periksa bukti, lalu pilih satu langkah berikutnya." }),
  {
    slug: "torisetsu-tsukurikata", title: "Cara membuat panduan diri sendiri: jalan praktis menuju pemahaman diri", listTitle: "Cara membuat panduan diri sendiri", description: "Buat panduan pribadi tentang kekuatan, tanda stres, kebutuhan komunikasi, dan cara pulih.", category: "Pemahaman diri", published: "2026-07-21", image: "/mascot/friend-hero.png", imageAlt: "Teman membuat panduan diri bersama",
    lead: ["Analisis diri kadang terasa seperti menjelaskan air saat sedang berenang. Panduan pribadi membuatnya konkret.", "Tujuannya bukan mendefinisikan diri selamanya, melainkan memberi petunjuk yang dapat digunakan sekarang."],
    sections: [
      { heading: "Apa yang perlu dimasukkan", paragraphs: ["Mulailah dari situasi dan pola yang dapat diamati."], list: [{ term: "Kondisi terbaik", body: "Ritme, struktur, orang, dan lingkungan yang memunculkan kekuatan." }, { term: "Preferensi komunikasi", body: "Cara menerima konteks, umpan balik, keputusan, dan dukungan." }, { term: "Tanda stres awal", body: "Perubahan kecil sebelum kewalahan." }, { term: "Cara mengatur ulang", body: "Tindakan spesifik yang memulihkan fokus." }] },
      { heading: "Langkah 1: mulai dari pola, bukan ideal", paragraphs: ["Tinjau momen yang terasa mudah, sulit, memberi energi, atau menguras tenaga. Catat yang benar-benar terjadi dan cari pengulangan."] },
      { heading: "Langkah 2: tambahkan sudut pandang orang lain", paragraphs: ["Tanyakan kepada orang tepercaya apa yang mereka andalkan dari Anda dan apa yang sulit dibaca saat Anda stres. Perbedaan adalah informasi, bukan vonis."] },
      { heading: "Jaga agar panduan dapat diperbarui", paragraphs: ["Tambahkan tanggal dan contoh, lalu tinjau kembali setelah perubahan peran atau lingkungan. Tulis kecenderungan, kondisi, atau hipotesis—bukan batas permanen."] },
    ],
  },
  {
    slug: "johari-no-mado", title: "Jendela Johari: menemukan sisi diri yang tidak terlihat sendirian", listTitle: "Apa itu Jendela Johari?", description: "Pahami apa yang diketahui atau tersembunyi bagi diri dan orang lain serta manfaat umpan balik.", category: "Pemahaman diri", published: "2026-07-21", image: "/characters/v3/fox_N.webp", imageAlt: "Karakter rubah melihat melalui jendela kesadaran diri",
    lead: ["Jendela Johari membandingkan apa yang Anda ketahui tentang diri dengan apa yang dapat dilihat orang lain.", "Kerangka ini memiliki empat area dan menunjukkan peran keterbukaan serta umpan balik."],
    sections: [
      { heading: "Empat area Jendela Johari", paragraphs: ["Area terbuka diketahui diri dan orang lain; area tersembunyi hanya diketahui diri; area buta dilihat orang lain; area tak dikenal belum jelas bagi siapa pun."], list: [{ term: "Area terbuka", body: "Hal yang diakui Anda dan orang lain." }, { term: "Area tersembunyi", body: "Perasaan dan pengalaman yang belum dibagikan." }, { term: "Area buta", body: "Dampak, kebiasaan, atau kekuatan yang dilihat orang lain lebih dulu." }, { term: "Area tak dikenal", body: "Potensi yang muncul dalam situasi baru." }] },
      { heading: "Mengapa area buta penting", paragraphs: ["Kekuatan yang terasa biasa mudah luput. Umpan balik spesifik mengubah dampak yang tidak terlihat menjadi sesuatu yang dapat dipahami dan dipilih."] },
      { heading: "Cara meminta umpan balik dengan aman", paragraphs: ["Ajukan pertanyaan sempit tentang konteks nyata, minta contoh, dan dengarkan sebelum memutuskan apa yang sesuai."] },
      { heading: "Umpan balik adalah jendela, bukan putusan", paragraphs: ["Satu orang melihat dari satu posisi. Gabungkan beberapa sudut pandang dengan pengalaman Anda sendiri."] },
    ],
  },
  {
    slug: "seikaku-aisho", title: "Dapatkah tipe kepribadian memprediksi kecocokan?", listTitle: "Bisakah tipe memprediksi kecocokan?", description: "Pelajari apa yang dapat dan tidak dapat dijelaskan kepribadian tentang cinta, persahabatan, konflik, dan komunikasi.", category: "Teman dan hubungan", published: "2026-07-21", image: "/characters/v3/penguin_N.webp", imageAlt: "Dua karakter menjelajahi kecocokan kepribadian",
    lead: ["Kecocokan bukan skor yang menentukan apakah dua orang harus bersama. Ini adalah peta tentang bagian yang terasa alami dan bagian yang memerlukan penerjemahan.", "Kepribadian membantu menjelaskan ritme, stimulasi, rencana, kepercayaan, dan kepekaan, tetapi tidak menggantikan rasa hormat dan keamanan."],
    sections: [
      { heading: "Kemiripan memudahkan kehidupan sehari-hari", paragraphs: ["Kecenderungan serupa menciptakan asumsi bersama, tetapi juga dapat memperkuat titik buta yang sama."] },
      { heading: "Perbedaan menciptakan keseimbangan atau gesekan", paragraphs: ["Sifat berbeda dapat saling melengkapi. Gesekan muncul ketika preferensi pribadi dianggap satu-satunya cara yang masuk akal."] },
      { heading: "Gunakan kecocokan sebagai awal percakapan", paragraphs: ["Bandingkan dimensi tertentu dan bicarakan contoh sehari-hari. Pembacaan yang baik memberi pilihan praktis, bukan alasan untuk tidak menghormati orang lain."] },
      { heading: "Yang penting di luar kepribadian", paragraphs: ["Nilai, keadaan, keterampilan komunikasi, kekuasaan, waktu, dan kesediaan memperbaiki hubungan ikut menentukan kualitas hubungan."] },
    ],
  },
  {
    slug: "tako-bunseki", title: "Cara meminta umpan balik kepribadian dari teman", listTitle: "Cara meminta umpan balik dari teman", description: "Kumpulkan sudut pandang orang lain tanpa canggung dan gunakan perbedaannya secara konstruktif.", category: "Teman dan hubungan", published: "2026-08-07", image: "/characters/v3/octopus_N.webp", imageAlt: "Karakter gurita mengumpulkan umpan balik dari teman",
    lead: ["Refleksi diri menunjukkan niat dan pengalaman batin. Umpan balik menunjukkan perilaku yang dapat diamati dan dampaknya.", "Keduanya membantu menemukan kekuatan yang dianggap biasa dan jarak antara maksud dengan penerimaan orang lain."],
    sections: [
      { heading: "Mengapa analisis diri saja terbatas", paragraphs: ["Kebiasaan yang akrab menjadi tak terlihat. Orang lain tidak melihat seluruh batin Anda, tetapi dapat melaporkan dampak pada momen yang mungkin Anda lupakan."], list: [{ term: "Analisis diri", body: "Menunjukkan niat, pengalaman pribadi, nilai, dan alasan." }, { term: "Sudut pandang luar", body: "Menunjukkan perilaku, dampak, dan pola yang dapat diamati." }] },
      { heading: "Apa yang dapat diungkapkan orang lain", paragraphs: ["Umpan balik berguna untuk pola yang dapat diamati: cara masuk ke kelompok, merespons tekanan, berbeda pendapat, atau membantu orang lain."] },
      { heading: "Metode tiga langkah", paragraphs: ["Buat permintaan yang fokus dan mudah dijawab."], list: [{ term: "1. Pilih beberapa sudut pandang", body: "Tanyakan kepada orang yang mengenal Anda dalam konteks berbeda." }, { term: "2. Gunakan pertanyaan yang sama", body: "Jawaban lebih mudah dibandingkan." }, { term: "3. Cari pola", body: "Utamakan pengamatan berulang dan contoh konkret." }] },
      { heading: "Pertanyaan anonim dan berbasis pilihan mengurangi kecanggungan", paragraphs: ["Orang lebih jujur ketika tidak dipaksa menulis kritik atau menempelkan nama pada setiap pengamatan."] },
      { heading: "Coba fitur teman di Alice Personalities", paragraphs: ["Selesaikan tes OCEAN Anda, bagikan tautan undangan, lalu bandingkan pandangan diri dengan pola jawaban teman. Gunakan hasil sebagai awal percakapan."] },
    ],
  },
];

export function getIdArticle(slug: string) {
  return ID_ARTICLES.find((article) => article.slug === slug);
}

const RELATED: Record<string, string[]> = {
  "ocean-shindan": ["sixteen-types-vs-ocean", "kaihousei", "tako-bunseki"],
  "sixteen-types-vs-ocean": ["ocean-shindan", "torisetsu-tsukurikata", "johari-no-mado"],
  kaihousei: ["ocean-shindan", "seijitsusei", "gaikousei"],
  seijitsusei: ["ocean-shindan", "kaihousei", "kyouchousei"],
  gaikousei: ["ocean-shindan", "kyouchousei", "seikaku-aisho"],
  kyouchousei: ["ocean-shindan", "gaikousei", "seikaku-aisho"],
  "shinkeisho-keiko": ["ocean-shindan", "johari-no-mado", "torisetsu-tsukurikata"],
  "torisetsu-tsukurikata": ["johari-no-mado", "tako-bunseki", "ocean-shindan"],
  "johari-no-mado": ["tako-bunseki", "torisetsu-tsukurikata", "ocean-shindan"],
  "seikaku-aisho": ["kyouchousei", "gaikousei", "tako-bunseki"],
  "tako-bunseki": ["johari-no-mado", "torisetsu-tsukurikata", "seikaku-aisho"],
};

export function getIdRelatedArticles(slug: string): IdArticle[] {
  return (RELATED[slug] ?? [])
    .map((relatedSlug) => getIdArticle(relatedSlug))
    .filter((article): article is IdArticle => Boolean(article));
}
