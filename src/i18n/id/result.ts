import type { BigFiveDimension } from "@/lib/types";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";

export const ID_RESULT_COPY = {
  metadataTitle: "Hasil Kepribadian Saya | Alice Test",
  metadataDescription: "Hasil tes kepribadian Big Five gratis Anda, dijelaskan melalui satu dari 32 tipe karakter.",
  heroLabel: "Tipe kepribadian saya",
  axesTitle: "Kepribadian saya dalam lima dimensi",
  axesDescription: "Setiap skala menunjukkan sisi yang terasa lebih alami bagi Anda saat ini. Tidak ada sisi yang lebih baik atau lebih buruk.",
  restart: "Ikuti tes lagi",
  allTypes: "Lihat semua 32 tipe",
  home: "Beranda",
} as const;

export type IdResultTypeCopy = {
  name: string;
  animal: string;
  essence: string;
  oneLiner: string;
};

export const ID_RESULT_TYPES: Record<ThirtyTwoTypeId, IdResultTypeCopy> = {
  "quiet-owl__N": { name: "Parkit Cemerlang", animal: "Parkit", essence: "Penyair", oneLiner: "Anda mengubah perasaan yang tak terucap menjadi kata-kata yang lembut dan hidup." },
  "quiet-owl__R": { name: "Elang Tenang", animal: "Elang", essence: "Sang Bijak", oneLiner: "Ketenangan Anda memberi orang lain kejernihan tanpa perlu banyak kata." },
  "seeker-wolf__N": { name: "Layang-layang Gesit", animal: "Burung layang-layang", essence: "Pemikir", oneLiner: "Rasa ingin tahu membawa Anda jauh menjelajahi gagasan dengan cara sendiri." },
  "seeker-wolf__R": { name: "Elang Pemburu Cermat", animal: "Elang pemburu", essence: "Ahli Strategi", oneLiner: "Anda membaca keseluruhan keadaan lalu memilih langkah berikutnya yang paling tepat." },
  "dreamer-rabbit__N": { name: "Penguin Ramah", animal: "Penguin", essence: "Pemimpi", oneLiner: "Dunia batin Anda dipenuhi kehangatan, imajinasi, dan kepedulian." },
  "dreamer-rabbit__R": { name: "Angsa Anggun", animal: "Angsa", essence: "Jiwa Ekspresif", oneLiner: "Anda menampilkan keindahan diri dengan tenang tanpa membandingkan diri dengan orang lain." },
  "fantasy-cat__N": { name: "Gagak Penasaran", animal: "Gagak", essence: "Kolektor", oneLiner: "Anda menemukan harta tersembunyi di tempat yang dilewati begitu saja oleh orang lain." },
  "fantasy-cat__R": { name: "Pelikan Santai", animal: "Pelikan", essence: "Perajin", oneLiner: "Anda menyempurnakan hal yang bermakna dengan sabar tanpa terburu-buru." },
  "caretaker-dog__N": { name: "Anjing Penuh Perhatian", animal: "Anjing", essence: "Pendamping", oneLiner: "Anda menyadari perubahan kecil pada orang lain dan membantu sebelum diminta." },
  "caretaker-dog__R": { name: "Kuda Andal", animal: "Kuda", essence: "Koordinator", oneLiner: "Anda tetap berada di sisi orang lain dan menjadi sumber kepercayaan yang kokoh." },
  "brisk-tiger__N": { name: "Harimau Gigih", animal: "Harimau", essence: "Pelatih", oneLiner: "Anda percaya usaha yang konsisten mengubah ambisi menjadi hasil nyata." },
  "brisk-tiger__R": { name: "Beruang Teguh", animal: "Beruang", essence: "Manajer", oneLiner: "Anda tetap berpijak saat tertekan dan membantu menstabilkan seluruh kelompok." },
  "smiley-panda__N": { name: "Panda Ceria", animal: "Panda", essence: "Pengarah", oneLiner: "Kehadiran Anda mencairkan suasana tegang dan membuat orang merasa nyaman." },
  "smiley-panda__R": { name: "Gajah Rileks", animal: "Gajah", essence: "Optimis", oneLiner: "Anda sungguh percaya bahwa hari esok dapat menjadi lebih baik." },
  "playful-raccoon__N": { name: "Rakun Jenaka", animal: "Rakun", essence: "Pelopor", oneLiner: "Anda menciptakan keseruan sendiri dan menggerakkan orang-orang di sekitar Anda." },
  "playful-raccoon__R": { name: "Badak Berani", animal: "Badak", essence: "Penantang", oneLiner: "Ketika orang lain ragu, Anda maju dan menciptakan momentum." },
  "sparkle-dolphin__N": { name: "Ubur-ubur Berkilau", animal: "Ubur-ubur", essence: "Sahabat", oneLiner: "Anda dekat dengan perasaan orang lain dan memasuki dunia baru bersama mereka." },
  "sparkle-dolphin__R": { name: "Lumba-lumba Berkepala Dingin", animal: "Lumba-lumba", essence: "Pemimpin", oneLiner: "Anda menyatukan berbagai harapan dan membimbing semua orang menuju impian bersama." },
  "ambition-lion__N": { name: "Ikan Pedang Lembut", animal: "Ikan pedang", essence: "Konduktor", oneLiner: "Anda melihat gambaran besar dan menempatkan orang di peran tempat mereka bersinar." },
  "ambition-lion__R": { name: "Orca Berwibawa", animal: "Orca", essence: "Jenderal", oneLiner: "Anda melihat medan yang lebih luas dan memimpin dengan keputusan yang mantap." },
  "idea-monkey__N": { name: "Ikan Badut Pemimpi", animal: "Ikan badut", essence: "Jurnalis", oneLiner: "Anda menemukan hal yang menyentuh hati lalu menyampaikannya dengan kata-kata sendiri." },
  "idea-monkey__R": { name: "Anjing Laut Santai", animal: "Anjing laut", essence: "Bintang Pesta", oneLiner: "Anda mencerahkan suasana seketika dan mengajak semua orang menikmati momen." },
  "whim-fox__N": { name: "Gurita Berjiwa Bebas", animal: "Gurita", essence: "Orator", oneLiner: "Kata-kata Anda menarik orang dan menggerakkan mereka tanpa memaksa." },
  "whim-fox__R": { name: "Hiu Mandiri", animal: "Hiu", essence: "Pembaru", oneLiner: "Anda mempertanyakan kebiasaan lama dan membuka jalan menuju masa depan yang dipercaya." },
  "earnest-elephant__N": { name: "Unikorn Bertulus Hati", animal: "Unikorn", essence: "Idealis", oneLiner: "Anda tidak melepaskan cita-cita yang membuat dunia terasa lebih baik." },
  "earnest-elephant__R": { name: "Naga Teguh", animal: "Naga", essence: "Penjaga", oneLiner: "Begitu menentukan hal yang penting, Anda menjaganya dengan kekuatan yang tak goyah." },
  "steady-turtle__N": { name: "Pegasus Penuh Aspirasi", animal: "Pegasus", essence: "Pengejar Prestasi", oneLiner: "Tanpa mencari perhatian, Anda terus meraih sesuatu yang lebih tinggi dengan tenang." },
  "steady-turtle__R": { name: "Phoenix Tangguh", animal: "Phoenix", essence: "Penyintas", oneLiner: "Berapa kali pun jatuh, Anda menemukan kekuatan untuk bangkit kembali." },
  "gentle-koala__N": { name: "Malaikat Penuh Perhatian", animal: "Malaikat", essence: "Pencinta Keindahan", oneLiner: "Mendoakan kebahagiaan orang lain adalah salah satu sukacita terdalam Anda." },
  "gentle-koala__R": { name: "Golem Tak Tergoyahkan", animal: "Golem", essence: "Penikmat", oneLiner: "Anda ingin mencintai hal yang penting dengan tenang, mendalam, dan tanpa tergesa." },
  "solo-hedgehog__N": { name: "Hantu Pemalu", animal: "Hantu", essence: "Detektif", oneLiner: "Anda mungkin tidak banyak bicara, tetapi entah bagaimana hampir selalu memperhatikan segalanya." },
  "solo-hedgehog__R": { name: "Kerangka Bebas", animal: "Kerangka", essence: "Sang Independen", oneLiner: "Tanpa terikat ekspektasi, Anda menjalani hidup mengikuti arah sendiri." },
};

export type IdResultAxis = {
  dim: BigFiveDimension;
  title: string;
  left: string;
  right: string;
  color: string;
  lowDescription: string;
  highDescription: string;
  lowStrength: string;
  highStrength: string;
  lowGrowth: string;
  highGrowth: string;
};

export const ID_RESULT_AXES: readonly IdResultAxis[] = [
  { dim: "O", title: "Keterbukaan", left: "Praktis", right: "Eksploratif", color: "#E4AE3A", lowDescription: "Anda merasa yakin dengan gagasan yang sudah dikenal dan pengalaman nyata yang terbukti.", highDescription: "Anda tertarik pada gagasan, pengalaman, dan sudut pandang baru.", lowStrength: "Anda menguji apakah sebuah ide benar-benar berguna dalam kehidupan sehari-hari.", highStrength: "Anda memberi sudut pandang segar ketika jawaban lama tidak lagi bekerja.", lowGrowth: "Cobalah eksperimen kecil tanpa meninggalkan dasar yang sudah stabil.", highGrowth: "Pilih satu kemungkinan cukup lama agar imajinasi berubah menjadi sesuatu yang nyata." },
  { dim: "C", title: "Ketelitian", left: "Fleksibel", right: "Teratur", color: "#88619A", lowDescription: "Anda menyesuaikan diri dengan keadaan alih-alih memaksakan semuanya ke dalam rencana tetap.", highDescription: "Anda suka menyusun tujuan dan merasa puas saat menuntaskannya.", lowStrength: "Anda cepat menemukan jalan baru ketika rencana lama tidak lagi sesuai.", highStrength: "Anda mengubah niat menjadi usaha yang konsisten dan dapat diandalkan.", lowGrowth: "Berikan diri Anda satu langkah berikutnya yang terlihat agar kebebasan tidak berubah menjadi tekanan mendadak.", highGrowth: "Sisakan sedikit ruang untuk improvisasi dan istirahat agar rencana tetap lentur." },
  { dim: "E", title: "Ekstraversi", left: "Tenang", right: "Supel", color: "#4298B4", lowDescription: "Anda mengisi ulang energi lewat waktu tenang dan lebih menyukai sedikit hubungan yang mendalam.", highDescription: "Percakapan dan kegiatan bersama memberi Anda energi dan mempertajam pikiran.", lowStrength: "Anda menangkap detail dan kedalaman yang sering hilang dalam percakapan ramai.", highStrength: "Anda menciptakan momentum dan membuat orang lain lebih mudah ikut terlibat.", lowGrowth: "Bagikan satu pikiran sebelum semuanya sempurna agar waktu memproses tidak disalahartikan sebagai jarak.", highGrowth: "Berhenti sejenak dan beri ruang bagi orang yang belum sempat bersuara." },
  { dim: "A", title: "Keramahan", left: "Mandiri", right: "Kooperatif", color: "#33A474", lowDescription: "Anda menghargai hubungan sambil tetap membuat penilaian jujur berdasarkan standar sendiri.", highDescription: "Anda peka terhadap perasaan orang dan secara alami mencari jalan yang harmonis.", lowStrength: "Anda berani menyebut persoalan yang dihindari orang lain dan melindungi kelompok dari kesepakatan semu.", highStrength: "Anda memahami hal yang membantu orang lain tetap terbuka dan tidak defensif.", lowGrowth: "Tambahkan konteks sebelum kesimpulan agar kejujuran terasa sebagai penghormatan.", highGrowth: "Nyatakan keinginan Anda lebih awal; kebaikan juga perlu menyertakan diri sendiri." },
  { dim: "N", title: "Kepekaan emosional", left: "Stabil", right: "Peka", color: "#F25E62", lowDescription: "Anda cenderung cepat kembali seimbang ketika sesuatu yang tidak terduga terjadi.", highDescription: "Anda menangkap perubahan emosi yang halus dan memikirkan hal penting secara mendalam.", lowStrength: "Ketenangan Anda membantu orang lain melihat langkah praktis berikutnya saat situasi menekan.", highStrength: "Kepekaan memberi Anda informasi awal tentang risiko dan dampak emosional.", lowGrowth: "Perhatikan sinyal yang lebih tenang sebelum memutuskan bahwa semuanya baik-baik saja.", highGrowth: "Pisahkan apa yang benar-benar diamati dari cerita yang muncul agar intuisi tidak berubah menjadi kekhawatiran." },
];
