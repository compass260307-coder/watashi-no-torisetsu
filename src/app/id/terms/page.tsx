import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";
import {
  formatIdrMinor,
  ID_FULL_ACCESS_PRICE_IDR_MINOR,
} from "@/lib/access-products";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Ketentuan Layanan",
  description:
    "Ketentuan penggunaan Alice Test. Harap baca sebelum menggunakan layanan.",
  alternates: localizedAlternates(
    "id",
    "/terms",
    "/ko/terms",
    "/en/terms",
    "/id/terms",
  ),
  robots: { index: true, follow: true },
};

export default function IndonesianTermsPage() {
  return (
    <LegalDocument
      title="Ketentuan Layanan"
      lastUpdated="18 September 2026"
      locale="id"
    >
      <p>
        Ketentuan ini mengatur penggunaan Alice Test (selanjutnya disebut
        “Layanan”) yang disediakan oleh Tim Operasional Alice Test (selanjutnya
        disebut “Operator”). Setiap orang yang menggunakan Layanan (selanjutnya
        disebut “Pengguna”) wajib menyetujui ketentuan ini sebelum menggunakan
        Layanan.
      </p>

      <h2>Pasal 1 (Ruang Lingkup)</h2>
      <ol>
        <li>Ketentuan ini berlaku untuk seluruh hubungan antara Pengguna dan Operator yang berkaitan dengan penggunaan Layanan.</li>
        <li>Aturan dan pemberitahuan khusus yang ditampilkan Operator dalam Layanan merupakan bagian dari ketentuan ini.</li>
        <li>Jika ketentuan ini berbeda dengan aturan khusus, aturan khusus berlaku sejauh tidak dinyatakan lain.</li>
      </ol>

      <h2>Pasal 2 (Definisi)</h2>
      <p>Istilah dalam ketentuan ini memiliki arti sebagai berikut.</p>
      <ol>
        <li>“Layanan” adalah layanan pendukung pemahaman diri bernama Alice Test, termasuk tes kepribadian Big Five, penilaian teman, konten astrologi, tarot, serta percakapan dengan AI generatif.</li>
        <li>“Operator” adalah Tim Operasional Alice Test.</li>
        <li>“Pengguna” adalah setiap individu yang menggunakan Layanan.</li>
        <li>“Konten Pengguna” adalah jawaban tes, jawaban penilaian teman, data kelahiran, pesan percakapan, dan informasi lain yang dimasukkan ke Layanan.</li>
        <li>“Hasil Generatif” adalah hasil tes, teks pembacaan, dan respons AI yang dibuat berdasarkan Konten Pengguna.</li>
      </ol>

      <h2>Pasal 3 (Pendaftaran dan Penggunaan)</h2>
      <ol>
        <li>Fungsi dasar Layanan dapat digunakan tanpa membuat akun.</li>
        <li>Email atau koneksi ke layanan pihak ketiga dapat diperlukan untuk memulihkan hasil, menerima pemberitahuan, atau memakai fungsi tertentu.</li>
        <li>Pengguna memakai Layanan atas tanggung jawab sendiri dan wajib mematuhi ketentuan ini.</li>
      </ol>

      <h2>Pasal 4 (Usia dan Pengguna di Bawah Umur)</h2>
      <ol>
        <li>Layanan tidak menetapkan batas usia umum.</li>
        <li>Pengguna di bawah usia 18 tahun wajib memperoleh persetujuan orang tua atau wali sah sebelum memakai atau membeli Layanan.</li>
        <li>Penggunaan oleh anak di bawah umur dianggap telah mendapat persetujuan tersebut.</li>
        <li>Anak di bawah usia 13 tahun hanya boleh menggunakan Layanan di bawah pengawasan orang tua atau wali.</li>
      </ol>

      <h2>Pasal 5 (Tindakan yang Dilarang)</h2>
      <p>Pengguna dilarang melakukan tindakan berikut.</p>
      <ol>
        <li>Melanggar hukum atau ketertiban umum.</li>
        <li>Melakukan atau membantu tindakan pidana.</li>
        <li>Melanggar hak kekayaan intelektual, hak atas gambar, privasi, reputasi, atau hak dan kepentingan Operator, pengguna lain, atau pihak ketiga.</li>
        <li>Menggunakan informasi dari Layanan secara komersial tanpa izin tertulis sebelumnya dari Operator.</li>
        <li>Mengganggu atau berisiko mengganggu pengoperasian Layanan.</li>
        <li>Mengakses tanpa izin, memperoleh data dengan cara tidak sah, atau mencoba melakukannya.</li>
        <li>Menyamar sebagai pengguna lain.</li>
        <li>Menggunakan atau memberikan kredensial maupun tautan pribadi orang lain.</li>
        <li>Beriklan, menawarkan, mengajak, atau menjalankan kegiatan usaha tanpa izin Operator.</li>
        <li>Mengumpulkan atau menyimpan informasi pribadi pengguna lain tanpa persetujuannya.</li>
        <li>Memberikan manfaat kepada kelompok kriminal atau antisosial.</li>
        <li>Menekan, memfitnah, melecehkan, atau menimbulkan beban psikologis yang tidak semestinya kepada pengguna lain.</li>
        <li>Mengakses Layanan dengan alat otomatis, bot, atau scraping tanpa izin.</li>
        <li>Melakukan rekayasa balik, dekompilasi, pembongkaran, atau modifikasi terhadap Layanan.</li>
        <li>Tindakan lain yang secara wajar dinilai tidak pantas oleh Operator.</li>
      </ol>

      <h2>Pasal 6 (Penghentian atau Penangguhan Layanan)</h2>
      <ol>
        <li>
          Operator dapat menghentikan atau menangguhkan seluruh atau sebagian Layanan tanpa pemberitahuan sebelumnya jika:
          <ol>
            <li>sistem memerlukan pemeliharaan, pemeriksaan, atau pembaruan;</li>
            <li>keadaan kahar seperti gempa, petir, kebakaran, pemadaman, atau bencana membuat Layanan sulit disediakan;</li>
            <li>komputer atau jaringan komunikasi berhenti karena insiden; atau</li>
            <li>Operator menilai penyediaan Layanan sulit dilanjutkan.</li>
          </ol>
        </li>
        <li>Kecuali terdapat kesengajaan atau kelalaian berat, Operator tidak bertanggung jawab atas kerugian akibat penghentian atau penangguhan tersebut.</li>
      </ol>

      <h2>Pasal 7 (Pembatasan Penggunaan dan Penghapusan Akses)</h2>
      <ol>
        <li>
          Operator dapat membatasi penggunaan atau menghapus akses tanpa pemberitahuan sebelumnya jika Pengguna:
          <ol>
            <li>melanggar ketentuan ini;</li>
            <li>memberikan informasi palsu;</li>
            <li>tidak menjawab komunikasi Operator dalam jangka waktu wajar;</li>
            <li>tidak memakai Layanan dalam jangka waktu lama; atau</li>
            <li>dinilai tidak layak menggunakan Layanan karena alasan yang wajar.</li>
          </ol>
        </li>
        <li>Kecuali terdapat kesengajaan atau kelalaian berat, Operator tidak bertanggung jawab atas kerugian yang timbul dari tindakan berdasarkan pasal ini.</li>
      </ol>

      <h2>Pasal 8 (Hak Kekayaan Intelektual)</h2>
      <ol>
        <li>Seluruh hak atas teks, gambar, karakter, desain, sistem, perangkat lunak, dan logika diagnosis dalam Layanan dimiliki Operator atau pemberi lisensinya.</li>
        <li>Hak atas jawaban yang dimasukkan Pengguna tetap dimiliki Pengguna. Pengguna mengizinkan Operator memakai data yang telah dianonimkan untuk peningkatan layanan, statistik, dan penelitian.</li>
        <li>Pengguna dapat memakai tangkapan layar hasil dan URL berbagi untuk penggunaan pribadi serta berbagi dengan teman.</li>
      </ol>

      <h2>Pasal 9 (Layanan Berbayar dan Pembayaran)</h2>
      <ol>
        <li>
          Edisi Lengkap ditawarkan dengan harga pembelian satu kali sebesar{" "}
          {formatIdrMinor(ID_FULL_ACCESS_PRICE_IDR_MINOR)}. Isi, harga akhir,
          dan syarat pembelian layanan berbayar ditampilkan pada layar pembelian
          dan halaman <a href="/id/legal/commerce">Informasi Penjualan dan Pengembalian Dana</a>.
        </li>
        <li>Waktu dan metode pembayaran mengikuti layar pembelian serta diproses melalui penyedia pembayaran yang ditunjuk, termasuk Stripe.</li>
        <li>Layanan berbayar merupakan konten digital. Edisi Lengkap memperoleh garansi uang kembali penuh selama 30 hari sejak pembayaran sesuai syarat dan prosedur pada halaman informasi penjualan. Operator juga akan memberi pengembalian dana atau penyelesaian yang tepat jika Layanan gagal disediakan karena kesalahan Operator.</li>
        <li>Pengguna di bawah umur wajib memperoleh persetujuan orang tua atau wali sebelum membeli.</li>
        <li>Operator dapat mengubah harga untuk pembelian mendatang, tetapi tidak menerapkannya pada transaksi yang telah selesai.</li>
      </ol>

      <h2>Pasal 10 (Tes, Astrologi, Tarot, dan Respons AI)</h2>
      <ol>
        <li>Hasil tes, pembacaan astrologi, tarot, dan respons AI ditujukan untuk hiburan serta membantu refleksi diri.</li>
        <li>Layanan bukan diagnosis, nasihat, atau perawatan medis, psikologis, hukum, keuangan, maupun profesional. Hubungi tenaga profesional yang berkualifikasi jika diperlukan.</li>
        <li>AI generatif dapat menghasilkan informasi yang tidak akurat, tidak lengkap, atau tidak sesuai maksud Pengguna. Operator tidak menjamin ketepatan, kelengkapan, atau kegunaannya.</li>
        <li>Keputusan penting mengenai pekerjaan, hubungan, kesehatan, hukum, atau keuangan tetap menjadi tanggung jawab Pengguna.</li>
        <li>Pengguna tidak boleh memasukkan data pribadi pihak ketiga, kata sandi, nomor kartu, atau informasi sensitif yang tidak diperlukan ke dalam percakapan.</li>
        <li>Penilaian teman dapat memengaruhi hubungan antarpengguna. Kecuali terdapat kesengajaan atau kelalaian berat, Operator tidak bertanggung jawab atas salah paham, konflik, atau perubahan hubungan yang timbul.</li>
      </ol>

      <h2>Pasal 11 (Penolakan Jaminan dan Batas Tanggung Jawab)</h2>
      <ol>
        <li>Operator tidak menjamin bahwa Layanan bebas dari cacat mengenai keamanan, keandalan, ketepatan, kelengkapan, efektivitas, kesesuaian tujuan, kesalahan, bug, atau pelanggaran hak.</li>
        <li>Kecuali disebabkan kesengajaan atau kelalaian berat Operator, Operator tidak bertanggung jawab atas kerugian yang timbul dari Layanan.</li>
        <li>Jika Operator wajib mengganti kerugian, tanggung jawab dibatasi pada kerugian langsung dan wajar yang benar-benar terjadi, paling banyak sejumlah total pembayaran Pengguna kepada Operator selama satu tahun sebelum penyebab kerugian terjadi, atau JPY 10.000 bila tidak ada pembayaran.</li>
        <li>Pembatasan ini hanya berlaku sejauh diizinkan hukum perlindungan konsumen dan ketentuan wajib lainnya.</li>
      </ol>

      <h2>Pasal 12 (Perubahan Layanan)</h2>
      <p>Operator dapat mengubah, menambah, atau menghentikan isi Layanan setelah memberikan pemberitahuan yang wajar kepada Pengguna.</p>

      <h2>Pasal 13 (Perubahan Ketentuan)</h2>
      <ol>
        <li>
          Operator dapat mengubah ketentuan tanpa persetujuan individual jika:
          <ol>
            <li>perubahan bermanfaat bagi Pengguna secara umum; atau</li>
            <li>perubahan wajar ditinjau dari tujuan kontrak, kebutuhan perubahan, dan isi setelah perubahan.</li>
          </ol>
        </li>
        <li>Operator akan mengumumkan isi dan tanggal berlaku perubahan melalui Layanan atau metode lain yang mudah dipahami sebelum perubahan berlaku.</li>
        <li>Penggunaan setelah tanggal berlaku dianggap sebagai persetujuan sejauh diizinkan oleh hukum.</li>
      </ol>

      <h2>Pasal 14 (Informasi Pribadi)</h2>
      <p>Operator menangani informasi pribadi sesuai <a href="/id/privacy">Kebijakan Privasi</a> yang berlaku pada Layanan.</p>

      <h2>Pasal 15 (Pemberitahuan dan Komunikasi)</h2>
      <p>Komunikasi dilakukan melalui pemberitahuan dalam Layanan, email, atau metode lain yang ditentukan Operator. Selama Pengguna tidak melaporkan perubahan kontak, Operator dapat menganggap kontak yang tersedia masih berlaku.</p>

      <h2>Pasal 16 (Larangan Pengalihan)</h2>
      <p>Tanpa persetujuan tertulis sebelumnya dari Operator, Pengguna tidak boleh mengalihkan kedudukan, hak, atau kewajiban berdasarkan kontrak penggunaan kepada pihak ketiga maupun menjadikannya jaminan.</p>

      <h2>Pasal 17 (Keterpisahan)</h2>
      <p>Jika suatu bagian ketentuan ini dinyatakan tidak sah atau tidak dapat dilaksanakan, bagian lainnya tetap berlaku sepenuhnya.</p>

      <h2>Pasal 18 (Hukum yang Berlaku dan Yurisdiksi)</h2>
      <ol>
        <li>Ketentuan ini ditafsirkan berdasarkan hukum Jepang.</li>
        <li>Sengketa mengenai Layanan tunduk pada pengadilan Jepang yang berwenang atas lokasi Operator, tanpa membatasi hak konsumen wajib di tempat Pengguna.</li>
      </ol>

      <h2>Pasal 19 (Kontak)</h2>
      <p>Pertanyaan mengenai ketentuan atau Layanan dapat dikirim ke:</p>
      <ul>
        <li>Operator: Tim Operasional Alice Test</li>
        <li>Email: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a></li>
      </ul>

      <hr />
      <p>Ditetapkan: 1 Juni 2026</p>
      <p>Terakhir direvisi: 18 September 2026</p>
    </LegalDocument>
  );
}
