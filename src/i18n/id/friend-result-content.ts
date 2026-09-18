import type { BigFiveDimension } from "@/lib/types";

type CheckItem = { title: string; body: string };
type Polarity<T> = { high: T; low: T };
type RelationCopy = { match: CheckItem[]; off: CheckItem[] };

export const ID_MOTE_BY_AXIS: Record<
  BigFiveDimension,
  { keyword: string; headline: string; body: string }
> = {
  E: {
    keyword: "Menyenangkan saat bersama",
    headline: "Daya tarik Anda adalah suasana cerah yang Anda bawa.",
    body: "Di mata teman, kehadiran Anda saja sudah membuat suasana lebih hidup. Anda mampu menjaga percakapan mengalir dan menanggapi ucapan orang lain dengan alami. Meskipun bagi Anda itu hanya menikmati waktu bersama, orang di sekitar merasa tidak pernah bosan saat bersama Anda. Waktu yang dihabiskan bersama Anda selalu membekas—itulah daya tarik terbesar Anda.",
  },
  A: {
    keyword: "Nyaman berada di sisi Anda",
    headline: "Daya tarik Anda adalah rasa aman yang menenangkan.",
    body: "Di mata teman, Anda peka terhadap perasaan orang lain dan mampu mendampingi mereka tanpa dibuat-buat. Anda tidak perlu memeriahkan suasana; berada di samping Anda saja membuat keadaan terasa lebih lembut. Rasa nyaman tanpa lelah ini justru menjadi daya tarik yang bertahan lama dalam cinta. Anda mungkin menganggapnya biasa, tetapi orang lain melihat Anda sebagai pasangan yang dapat membawa kebahagiaan.",
  },
  O: {
    keyword: "Dunia terasa lebih luas bersama Anda",
    headline: "Daya tarik Anda adalah rasa ingin tahu yang tidak membosankan.",
    body: "Di mata teman, Anda selalu memiliki pengetahuan dan hal menarik untuk dibagikan. Berbicara dengan Anda membuka cara pandang baru; pemandangan yang sama pun terasa berbeda. Rangsangan itulah yang membuat orang semakin tertarik. Anda mungkin hanya membicarakan hal yang disukai, tetapi bagi orang lain Anda adalah sosok yang membuat setiap hari terasa baru.",
  },
  C: {
    keyword: "Dapat diandalkan",
    headline: "Daya tarik Anda adalah ketulusan yang terlihat melalui tindakan.",
    body: "Di mata teman, setiap janji yang Anda tepati dan setiap tanggung jawab yang Anda selesaikan membangun kepercayaan. Anda tidak perlu tampil mencolok; kepastian bahwa Anda melakukan apa yang dikatakan lebih kuat daripada kata-kata manis. Anda mungkin menganggapnya wajar, tetapi orang lain tahu bahwa Anda dapat diandalkan saat dibutuhkan. Daya tarik ini tumbuh perlahan dan kuat.",
  },
  N: {
    keyword: "Ketenangan dalam segala keadaan",
    headline: "Daya tarik Anda adalah ketenangan yang memberi rasa aman.",
    body: "Di mata teman, Anda tidak mudah goyah oleh hal kecil. Saat orang lain panik, ketenangan Anda menstabilkan suasana. Rasa tidak akan dipermainkan oleh keadaan ini semakin terasa berharga seiring hubungan berjalan. Anda mungkin hanya bersikap alami, tetapi orang di sekitar benar-benar merasakan kelapangan hati dan rasa aman saat bersama Anda.",
  },
};

export const ID_MOTE_CHECK_BY_AXIS: Record<BigFiveDimension, Polarity<CheckItem>> = {
  E: {
    high: { title: "Energi cerah yang menghidupkan suasana", body: "Kehadiran Anda saja membuat suasana lebih hidup. Waktu bersama Anda terasa berkesan bagi orang lain." },
    low: { title: "Membuat waktu berdua terasa mendalam", body: "Daya tarik Anda paling terlihat dalam percakapan satu lawan satu. Perhatian yang tenang membuat waktu bersama terasa istimewa." },
  },
  A: {
    high: { title: "Ahli memberi perhatian", body: "Orang lain menyadari bantuan kecil yang Anda berikan. Anda mungkin sudah identik dengan sosok yang baik hati." },
    low: { title: "Pendirian yang tidak mudah goyah", body: "Pendapat yang tidak mudah terbawa arus terlihat sebagai keteguhan yang dapat diandalkan." },
  },
  O: {
    high: { title: "Membuat dunia terasa lebih luas", body: "Anda selalu menemukan kegiatan dan topik baru. Orang lain merasa tidak akan bosan saat bersama Anda." },
    low: { title: "Kenyamanan yang stabil", body: "Ketenangan yang tidak terseret tren menjadi rasa aman yang membuat orang ingin bersama Anda lebih lama." },
  },
  C: {
    high: { title: "Ketulusan dalam menepati janji", body: "Tindakan Anda yang sesuai dengan ucapan menumbuhkan keyakinan bahwa Anda dapat dipercaya." },
    low: { title: "Kebebasan yang santai", body: "Sikap alami yang tidak terlalu kaku membuat Anda terasa mudah dan nyaman untuk diajak bersama." },
  },
  N: {
    high: { title: "Kepekaan yang halus", body: "Kemampuan menangkap perubahan kecil memberi rasa aman bahwa Anda benar-benar memahami orang lain." },
    low: { title: "Kelapangan hati yang tidak mudah goyah", body: "Ketenangan Anda menghadapi keadaan tak terduga membuat orang merasa aman saat berada di sisi Anda." },
  },
};

export const ID_MOTE_CHECK_EXTRA_BY_AXIS: Record<BigFiveDimension, Polarity<CheckItem>> = {
  E: {
    high: { title: "Tanggapan yang penuh semangat", body: "Jawaban antusias terhadap ajakan membuat orang yang mengajak merasa keberaniannya dihargai." },
    low: { title: "Pendengar yang membuat orang ingin terus bercerita", body: "Cara Anda mendengarkan dengan tenang sampai selesai mengundang cerita yang lebih dalam." },
  },
  A: {
    high: { title: "Sikap adil tanpa dua wajah", body: "Memperlakukan semua orang dengan kehangatan yang sama membangun kesan bahwa Anda dapat dipercaya." },
    low: { title: "Selera yang jelas", body: "Kejujuran tentang suka dan tidak suka justru membuat orang merasa lebih mudah bersama Anda." },
  },
  O: {
    high: { title: "Banyak bahan percakapan", body: "Beragam minat yang menjaga percakapan tetap mengalir membuat orang ingin berbicara lagi dengan Anda." },
    low: { title: "Rasa aman dari kebiasaan yang terjaga", body: "Menghargai tempat dan kebiasaan yang akrab memberi kesan bahwa hubungan dengan Anda dapat bertahan lama." },
  },
  C: {
    high: { title: "Tertib dalam pesan dan waktu", body: "Kesungguhan Anda dalam membalas pesan dan menepati waktu membuat orang merasa dihargai." },
    low: { title: "Keluwesan yang menenangkan", body: "Sikap fleksibel yang tidak terikat rencana membuat orang merasa tidak perlu terus bersikap tegang." },
  },
  N: {
    high: { title: "Kata-kata yang menyentuh perasaan", body: "Ucapan yang tepat pada saat sulit adalah penghiburan yang hanya lahir dari kepekaan Anda." },
    low: { title: "Kestabilan yang selalu sama", body: "Suasana stabil setiap kali bertemu membuat kehadiran Anda terasa seperti tempat untuk pulang." },
  },
};

export const ID_MOTE_HINT_CHECKS_BY_AXIS: Record<BigFiveDimension, CheckItem[]> = {
  E: [
    { title: "Tunjukkan sisi yang lebih bersemangat", body: "Pada pertemuan berikutnya, cobalah tertawa dan menikmati suasana sedikit lebih lepas. Perbedaannya dari kesan tenang Anda akan menjadi daya tarik." },
    { title: "Cobalah mengajak lebih dahulu", body: "Mulailah dengan satu kalimat seperti, ‘Lain kali, mau pergi ke sini?’ Sisi aktif Anda akan terasa segar." },
  ],
  A: [
    { title: "Sampaikan kebaikan dengan kata-kata", body: "Tambahkan satu kalimat seperti, ‘Anda baik-baik saja?’ atau ‘Boleh saya bantu?’ Perasaan mulai tersampaikan ketika diucapkan." },
    { title: "Jangan melupakan ucapan terima kasih kecil", body: "Sampaikan terima kasih dengan jelas atas hal yang dilakukan untuk Anda. Pertukaran perhatian memperpendek jarak." },
  ],
  O: [
    { title: "Ucapkan hal yang membuat Anda tertarik", body: "Usulkan tempat atau kegiatan yang ingin Anda coba. Sisi aktif yang tak terduga memberi kesan kuat." },
    { title: "Tambahkan satu sisi baru", body: "Mulailah satu tantangan kecil. Cerita tentangnya saja dapat membuat kesan Anda terasa jauh lebih utuh." },
  ],
  C: [
    { title: "Tepati justru janji-janji kecil", body: "Tunjukkan ketertiban dalam waktu bertemu dan membalas pesan. Itu saja dapat mengubah kesan Anda satu tingkat." },
    { title: "Tunjukkan bahwa ucapan menjadi tindakan", body: "Selesaikan diam-diam hal yang Anda katakan akan dilakukan. Kemampuan bertindak yang tidak dibuat-buat akan membekas." },
  ],
  N: [
    { title: "Ungkapkan perasaan lemah dengan jujur", body: "Saat tidak bersemangat, katakan saja, ‘Hari ini saya agak lesu.’ Kejujuran mengubah kepekaan menjadi daya tarik." },
    { title: "Perbanyak hari dengan suasana yang stabil", body: "Cobalah berinteraksi dengan ketenangan yang konsisten. Rasa aman adalah salah satu daya tarik terkuat." },
  ],
};

export const ID_LOVE_SCENE_BY_AXIS: Record<BigFiveDimension, Polarity<string>> = {
  E: {
    high: "Di acara apa pun, tanpa disadari tawa muncul di sekitar Anda. Jika seseorang berkata bahwa hari itu menyenangkan saat perjalanan pulang, biasanya Anda ikut menjadi alasannya.",
    low: "Daya tarik Anda paling terlihat saat berdua di kafe, bukan di keramaian. Kenyamanan percakapan yang perlahan mengalir membuat orang lain semakin terpikat.",
  },
  A: {
    high: "Perhatian kecil saat berkencan—seperti membagikan makanan atau memastikan jadwal pulang—menjadi alasan seseorang ingin mengajak Anda lagi.",
    low: "Anda dapat mengatakan dengan jelas tempat yang ingin dikunjungi dan film yang ingin ditonton, sehingga rencana mudah diputuskan. Kejujuran selera itu sangat disukai.",
  },
  O: {
    high: "Tempat yang Anda usulkan dengan, ‘Mau mencoba ke sini?’ selalu tepat sasaran. Kencan bersama Anda terasa tidak pernah mengecewakan.",
    low: "Tempat, jalan, dan percakapan yang akrab membuat kencan rutin bersama Anda memberi rasa aman bahwa hubungan ini menenangkan.",
  },
  C: {
    high: "Anda mungkin tiba sepuluh menit sebelum waktu janji. Ketelitian mengingat hari istimewa dan janji kecil perlahan menyentuh hati.",
    low: "Anda mampu menikmati kencan spontan tanpa jadwal yang terlalu padat. Kenyamanan untuk bertemu dan berpisah dengan santai sebenarnya sangat berharga.",
  },
  N: {
    high: "Anda dapat menyadari sesuatu terjadi hanya dari sedikit perubahan dalam pesan. Pasti ada orang yang pernah tertolong oleh kepekaan itu.",
    low: "Meski ada pembatalan mendadak atau masalah kecil, Anda dapat tersenyum dan berkata bahwa tidak apa-apa. Apa pun yang terjadi dapat Anda arahkan kembali menjadi menyenangkan.",
  },
};

export const ID_AXIS_INSIGHT_COPY: Record<BigFiveDimension, { match: string; higher: string; lower: string }> = {
  O: {
    match: "Kecepatan Anda berdua menanggapi tempat baru atau ide menarik hampir sama. Satu ucapan ‘itu menarik’ saja membuat rencana mengalir dengan alami.",
    higher: "Saat bersama {name}, Anda tampak lebih ringan melangkah daripada yang Anda kira. Tempat yang semula hanya disebut menarik sering akhirnya benar-benar kalian datangi bersama.",
    lower: "Mungkin masih ada acara atau tempat yang sebenarnya menarik bagi Anda tetapi belum diceritakan kepada {name}. Begitu Anda mengatakannya, akhir pekan kalian dapat menjadi jauh lebih berwarna.",
  },
  C: {
    match: "Cara kalian memperlakukan janji dan rencana hampir sama. Bahkan rasa terhadap waktu bertemu pun selaras, sehingga sedikit sekali alasan untuk saling kesal.",
    higher: "{name} benar-benar melihat cara Anda menyelesaikan tugas dan menepati janji. Anda dipandang sebagai orang yang aman untuk dipercaya memegang tanggung jawab.",
    lower: "Cara Anda mengatur langkah tampak sedikit lebih bebas bagi {name}. Menyepakati bagian penting lebih dahulu akan membuat waktu kalian berjalan lebih lancar.",
  },
  E: {
    match: "Baik saat bersenang-senang maupun bersantai, tingkat energi kalian selaras dengan alami. Tidak perlu selalu menjelaskan suasana hati adalah kenyamanan terbesar hubungan ini.",
    higher: "Di depan {name}, Anda tampak jauh lebih sering tertawa daripada biasanya. Percakapan dengan {name} mampu mengembalikan energi Anda setelah hari yang melelahkan.",
    lower: "Bagi {name}, Anda terlihat sedikit lebih tenang. Jika Anda menunjukkan sisi yang benar-benar menikmati karaoke, perjalanan, atau kegiatan lain, {name} akan semakin senang.",
  },
  A: {
    match: "Suhu perhatian kalian hampir sama, sehingga tidak ada satu pihak yang terus mengalah. Kalian dapat mencapai jalan tengah dengan alami.",
    higher: "{name} menangkap semua perhatian kecil Anda—mengisi gelas yang kosong atau mengakhiri pertemuan lebih awal saat seseorang lelah. Cobalah sesekali menjadi pihak yang bersandar.",
    lower: "Perhatian Anda mungkin baru setengahnya terlihat oleh {name}. Saat Anda mengucapkan ‘Boleh saya bawakan?’ atau ‘Anda baik-baik saja?’, bagi {name} kehangatan itu akan tersampaikan lebih utuh.",
  },
  N: {
    match: "Kalian memahami cara masing-masing melewati hari yang berat. Bahkan tanpa kata-kata penghiburan, berada bersama saja dapat membantu pemulihan.",
    higher: "{name} adalah orang yang kembali bertanya apakah Anda benar-benar baik-baik saja setelah Anda tersenyum. Kepekaan dan sisi yang Anda sembunyikan sudah terlihat olehnya.",
    lower: "Di depan {name}, Anda selalu tampak tenang dan stabil. Itu menandakan rasa aman, tetapi pada hari yang berat Anda tetap boleh berkata jujur karena ia dapat menerimanya.",
  },
};

export const ID_KOTSU_COPY: Record<BigFiveDimension, RelationCopy> = {
  O: {
    match: [
      { title: "Segera bagikan ide yang muncul", body: "Saat sesuatu terasa menarik, kirimkan kepada {name} pada hari yang sama. Kesamaan rasa ingin tahu menjaga hubungan tetap segar." },
      { title: "Nikmati minat baru bersama", body: "Jika salah satu menemukan hal baru yang disukai, cobalah berdua. Kesempatan menikmati antusiasme yang sama sangat berharga." },
    ],
    off: [
      { title: "Samakan suhu saat mengajak", body: "Saat mengajak mencoba hal baru, mulailah dengan, ‘Saya tertarik, bagaimana menurut Anda?’ Perbedaan kecepatan dapat dijembatani lewat cara bertanya." },
      { title: "Siapkan dua pilihan tujuan", body: "Tawarkan satu tempat yang akrab dan satu tempat baru. Apa pun pilihannya, kalian tetap dapat menikmatinya." },
    ],
  },
  C: {
    match: [
      { title: "Bergantian mengurus rencana", body: "Karena cara kalian mirip, gunakan giliran seperti, ‘Berikutnya saya yang memilih.’ Beban tidak akan terkumpul pada satu orang." },
      { title: "Nyatakan tujuan bersama", body: "Ceritakan target belajar, pekerjaan, atau hal lain satu sama lain. Kalian dapat menjadi pengingat ritme yang baik." },
    ],
    off: [
      { title: "Tetapkan rencana penting lebih awal", body: "Pastikan tanggal dan tempat sejak awal. Perbedaan cara mengatur langkah hampir hilang setelah hal penting diputuskan." },
      { title: "Jadikan ketepatan waktu sebagai aturan", body: "Perbedaan rasa terhadap waktu bukan kesalahan karakter. Buat aturan ringan yang cocok untuk kalian agar tidak perlu saling menyalahkan." },
    ],
  },
  E: {
    match: [
      { title: "Habiskan hari istirahat bersama", body: "Bagikan bukan hanya hari yang ramai, tetapi juga waktu tanpa melakukan apa-apa. Hubungan yang mampu berkata ‘hari ini santai saja’ patut dijaga." },
      { title: "Buat hari tanpa rencana", body: "Cobalah menjalani satu hari tanpa menentukan apa pun. Dua orang dengan energi yang selaras dapat menikmati spontanitas." },
    ],
    off: [
      { title: "Jujur tentang energi hari ini", body: "Katakan lebih dahulu apakah Anda ingin tenang atau ingin ramai. Itu membuat waktu bersama {name} lebih nyaman." },
      { title: "Bertemu singkat tetapi bermakna", body: "Pertemuan yang singkat dan padat mungkin lebih nyaman daripada waktu panjang. Menetapkan jam pulang juga merupakan bentuk perhatian." },
    ],
  },
  A: {
    match: [
      { title: "Sesekali tunjukkan keinginan sendiri", body: "Justru karena kalian pandai memperhatikan, ucapan ‘sebenarnya saya ingin ini’ akan membuat hubungan lebih dekat." },
      { title: "Berani menentukan secara acak", body: "Jika kalian terus saling mengalah, gunakan gunting-batu-kertas atau undian. Cara memutuskan pun dapat menjadi permainan." },
    ],
    off: [
      { title: "Ucapkan apa yang Anda butuhkan", body: "Daripada menunggu dipahami, katakan ‘tolong bantu saya dengan ini.’ {name} mungkin menunggu Anda mengandalkannya." },
      { title: "Sampaikan terima kasih dengan jelas", body: "Ucapkan terima kasih dengan hangat atas bantuan yang diterima. Perbedaan cara menunjukkan perhatian dapat dijembatani lewat kata-kata." },
    ],
  },
  N: {
    match: [
      { title: "Pada hari berat, cukup berada di sisi", body: "Tidak selalu perlu saling menyemangati. Ada hari ketika mendengarkan dan menemani saja sudah membantu pemulihan." },
      { title: "Rayakan saat keadaan membaik", body: "Rayakan hari ketika kalian kembali bersemangat. Karena sama-sama mengenal hari sulit, nilai hari bahagia terasa dua kali lipat." },
    ],
    off: [
      { title: "Tanyakan sekali lagi apakah benar baik-baik saja", body: "Meski tampak tenang, batin seseorang mungkin masih tegang. Satu pertanyaan tambahan dapat menjadi tempat aman." },
      { title: "Jangan mengkhawatirkan kecepatan balasan", body: "Anggap balasan lambat sebagai tanda bahwa seseorang sedang beristirahat. Kesepakatan ini membuat hubungan jauh lebih ringan." },
    ],
  },
};

export const ID_WANA_COPY: Record<BigFiveDimension, RelationCopy> = {
  O: {
    match: [
      { title: "Terlalu banyak rencana seru", body: "Karena sama-sama mudah berkata setuju, jadwal dan biaya dapat cepat penuh. Sesekali salah satu perlu menjadi rem." },
      { title: "Kehilangan minat secara bersamaan", body: "Jika antusiasme kalian padam bersamaan, komunikasi juga mudah terputus. Tetap kirim satu sapaan meski tren sudah berlalu." },
    ],
    off: [
      { title: "Terus mengajak dengan kecepatan sendiri", body: "Jika satu pihak terus mengajak, pihak lain dapat lelah menolak. Tanggapan yang lambat mungkin tanda untuk beristirahat sejenak." },
      { title: "Hanya mengejar hal baru", body: "Jika hanya membicarakan hal baru, seseorang dapat merasa tertinggal. Sediakan juga hari untuk tempat dan cerita yang sudah akrab." },
    ],
  },
  C: {
    match: [
      { title: "Sama-sama mengira pihak lain akan mengurus", body: "Saat keduanya berpikir orang lain akan melakukannya, tidak ada yang membuat reservasi. Tetapkan penanggung jawab dengan kata-kata." },
      { title: "Mengisi jadwal terlalu padat", body: "Rencana tanpa ruang mudah runtuh ketika salah satu lelah. Sisakan jeda yang cukup." },
    ],
    off: [
      { title: "Menumpuk kekesalan kecil", body: "Pihak yang ingin cepat dan pihak yang ingin menunggu memiliki ritme berbeda. Mengetahui bahwa ini perbedaan sifat dapat mengurangi banyak gesekan." },
      { title: "Berdebat tentang apa yang pernah dikatakan", body: "Janji lisan mudah menimbulkan perbedaan ingatan. Tinggalkan satu baris pesan untuk hal yang sudah diputuskan." },
    ],
  },
  E: {
    match: [
      { title: "Bersenang-senang sampai sama-sama kelelahan", body: "Dua orang yang mudah bersemangat sering terlambat menyadari lelah. Berani berkata waktunya pulang juga tanda kedekatan." },
      { title: "Dunia yang hanya berisi kalian berdua", body: "Terlalu nyaman dapat membuat hubungan lain terabaikan. Waktu dalam lingkaran masing-masing memberi bahan cerita baru." },
    ],
    off: [
      { title: "Membiarkan perbedaan energi", body: "Jika hanya satu pihak terus bersemangat, pihak lain dapat diam-diam terkuras. Jangan lupa memeriksa suhu suasana." },
      { title: "Mengira diam berarti marah", body: "Keheningan tidak selalu berarti suasana hati buruk. Ingatlah bahwa kalian boleh nyaman tanpa bicara." },
    ],
  },
  A: {
    match: [
      { title: "Lingkaran saling mengalah tanpa akhir", body: "Jika kalian hanya berkata terserah, memilih hal sederhana pun melelahkan. Bergantianlah menjadi orang yang menentukan." },
      { title: "Menyimpan ketidakpuasan kecil", body: "Dua orang yang baik hati justru mudah memendam rasa tidak nyaman. Sampaikan selagi masih ringan." },
    ],
    off: [
      { title: "Menganggap perhatian sebagai hal biasa", body: "Sadari usaha orang yang menyesuaikan diri dan jangan lupakan ucapan terima kasih." },
      { title: "Berharap dipahami tanpa berbicara", body: "Cara menangkap isyarat berbeda pada setiap orang. Mengatakannya lebih akurat daripada menunggu." },
    ],
  },
  N: {
    match: [
      { title: "Tenggelam bersama", body: "Batasi waktu untuk membicarakan hal berat, lalu siapkan sesuatu yang ringan agar kalian dapat bernapas kembali." },
      { title: "Saling memperbesar kecemasan", body: "Kekhawatiran satu orang dapat menyalakan kecemasan orang lain. Ambil napas sejenak sebelum berbicara." },
    ],
    off: [
      { title: "Menerima begitu saja ucapan ‘saya baik-baik saja’", body: "Sesekali memastikan sekali lagi dapat menjadi bentuk kebaikan bagi orang lain." },
      { title: "Menyalahkan perbedaan suhu perasaan", body: "Perbedaan cara merasakan bukan sesuatu yang harus diperbaiki, melainkan sesuatu yang perlu diketahui bersama." },
    ],
  },
};

export function idEstimatedSummaryParas(percent: number, viewer: string): string[] {
  if (percent >= 85) return [
    `Berdasarkan jawabannya, ${viewer} memahami Anda dengan sangat tepat. Rasa dipahami membuat Anda dapat menjadi diri sendiri dengan nyaman.`,
    `Dipahami hingga bagian yang belum diucapkan bukan hal yang biasa. Pemahaman dan rasa aman ini adalah kekuatan terbesar hubungan kalian.`,
  ];
  if (percent >= 70) return [
    `Cara ${viewer} melihat Anda sebagian besar bertemu dengan cara Anda melihat diri sendiri. Perbedaan kecil pun berada pada jarak yang nyaman untuk dibicarakan.`,
    `Tidak semua hal harus sama. Karena sudah ada dasar saling memahami, perbedaan dapat dinikmati sebagai penemuan baru setiap kali kalian berbicara.`,
  ];
  if (percent >= 55) return [
    `Ada beberapa sisi Anda yang terlihat sedikit berbeda bagi ${viewer}. Perbedaan itu memberi ruang untuk saling mengenal lebih dalam.`,
    `Perbedaan bukan hal buruk; itu berarti ${viewer} menemukan sisi yang belum Anda sadari. Menanyakannya langsung dapat membuka percakapan yang menyenangkan.`,
  ];
  return [
    `Perbedaan cara pandang Anda dan ${viewer} cukup besar. Bukan berarti tidak cocok; hubungan ini dapat menunjukkan sisi diri yang tidak terduga.`,
    `Sosok yang terlihat di depan ${viewer} dan sosok yang Anda kenali sendiri sama-sama merupakan diri Anda. Mengenal keduanya membuat Anda semakin bebas menjadi diri sendiri.`,
  ];
}
