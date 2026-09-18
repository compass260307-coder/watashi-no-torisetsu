import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Kebijakan privasi Alice Test dan penjelasan lengkap mengenai penanganan informasi pribadi.",
  alternates: localizedAlternates(
    "id",
    "/privacy",
    "/ko/privacy",
    "/en/privacy",
    "/id/privacy",
  ),
  robots: { index: true, follow: true },
};

export default function IndonesianPrivacyPage() {
  return (
    <LegalDocument
      title="Kebijakan Privasi"
      lastUpdated="18 September 2026"
      locale="id"
    >
      <p>
        Tim Operasional Alice Test (selanjutnya disebut “Operator”) menetapkan
        kebijakan ini untuk menjelaskan cara informasi pribadi pengguna
        (selanjutnya disebut “Pengguna”) ditangani dalam Alice Test (selanjutnya
        disebut “Layanan”).
      </p>

      <h2>Pasal 1 (Prinsip Dasar)</h2>
      <p>
        Operator mematuhi hukum perlindungan informasi pribadi Jepang dan hukum
        lain yang berlaku, serta menangani informasi pribadi secara tepat sesuai
        kebijakan ini.
      </p>

      <h2>Pasal 2 (Informasi yang Dikumpulkan)</h2>
      <p>Operator mengumpulkan informasi berikut untuk menyediakan Layanan.</p>

      <h3>1. Informasi yang dimasukkan langsung oleh Pengguna</h3>
      <ul>
        <li>Jawaban pada tes kepribadian.</li>
        <li>Jawaban pada penilaian teman.</li>
        <li>Nama panggilan yang diberikan secara opsional.</li>
        <li>Email untuk tautan masuk, konfirmasi pembelian, dan pemulihan akses.</li>
        <li>Tanggal, waktu, dan wilayah atau koordinat kelahiran untuk Peta Takdir.</li>
        <li>Pengenal pengguna bila Pengguna menghubungkan layanan pihak ketiga.</li>
        <li>Pesan kepada Alice, respons AI, dan riwayat percakapan.</li>
      </ul>

      <h3>2. Informasi pembelian layanan berbayar</h3>
      <ul>
        <li>Riwayat pembelian, produk, jumlah, mata uang, dan status pembayaran.</li>
      </ul>
      <p>
        Nomor kartu lengkap dan data pembayaran sensitif diproses langsung oleh
        Stripe dan tidak dikumpulkan maupun disimpan Operator.
      </p>

      <h3>3. Informasi yang dikumpulkan secara otomatis</h3>
      <ul>
        <li>Alamat IP.</li>
        <li>Jenis dan versi browser.</li>
        <li>Perangkat, sistem operasi, dan ukuran layar.</li>
        <li>Waktu akses dan URL halaman yang dibuka.</li>
        <li>Perujuk atau sumber kunjungan.</li>
        <li>Cookie, Local Storage, dan teknologi serupa.</li>
        <li>Log operasi seperti klik, perpindahan halaman, kesalahan, pengenal kampanye, dan peristiwa pengukuran konversi.</li>
      </ul>

      <h3>4. Informasi hubungan pertemanan</h3>
      <ul>
        <li>Kode undangan.</li>
        <li>Hubungan antara pengundang dan orang yang memberikan penilaian.</li>
      </ul>
      <p>
        Selain email dan informasi yang secara sukarela dimasukkan, Layanan pada
        prinsipnya tidak meminta nama lengkap, alamat rumah, atau nomor telepon.
      </p>

      <h2>Pasal 3 (Tujuan Penggunaan)</h2>
      <p>Informasi digunakan untuk tujuan berikut.</p>
      <ol>
        <li>Menyediakan Layanan dan menghasilkan hasil kepribadian.</li>
        <li>Menghitung peta kelahiran dan membuat Peta Takdir.</li>
        <li>Membuat respons Alice, menyimpan percakapan, mengelola kuota, dan menjaga keamanan.</li>
        <li>Mengirim tautan masuk serta memulihkan hasil dan pembelian.</li>
        <li>Menyediakan penilaian teman dan perbandingan sudut pandang.</li>
        <li>Memproses pembayaran, memberikan akses, dan mengelola riwayat pembelian.</li>
        <li>Mengirim pemberitahuan yang diminta Pengguna.</li>
        <li>Meningkatkan Layanan, mengembangkan fitur, dan memperbaiki kualitas.</li>
        <li>Menganalisis penggunaan dan membuat statistik.</li>
        <li>Mencegah akses tidak sah, penipuan, dan penyalahgunaan.</li>
        <li>Menjawab pertanyaan dan dukungan Pengguna.</li>
        <li>Menangani pelanggaran ketentuan layanan.</li>
      </ol>
      <p>
        Operator dapat memakai statistik yang telah diolah sehingga individu
        tidak dapat dikenali untuk peningkatan layanan, penelitian, dan publikasi,
        serta tidak akan mencoba mengidentifikasi kembali individu dari statistik
        tersebut.
      </p>

      <h2>Pasal 4 (Pemberian kepada Pihak Ketiga)</h2>
      <ol>
        <li>Operator tidak memberikan informasi pribadi kepada pihak ketiga tanpa persetujuan Pengguna.</li>
        <li>
          Pemberian dapat dilakukan bila:
          <ol>
            <li>diwajibkan oleh hukum;</li>
            <li>diperlukan untuk melindungi nyawa, tubuh, atau harta dan sulit memperoleh persetujuan;</li>
            <li>diperlukan untuk kesehatan masyarakat atau perlindungan anak dan sulit memperoleh persetujuan; atau</li>
            <li>diperlukan untuk bekerja sama dengan lembaga pemerintah dalam menjalankan tugas hukumnya.</li>
          </ol>
        </li>
      </ol>

      <h2>Pasal 5 (Penyedia Layanan dan Pemroses Data)</h2>
      <p>
        Informasi dapat dikirim kepada penyedia berikut hanya sejauh diperlukan
        untuk mengoperasikan Layanan.
      </p>
      <table>
        <thead>
          <tr><th>Penyedia</th><th>Lokasi</th><th>Tujuan</th></tr>
        </thead>
        <tbody>
          <tr><td>Vercel Inc.</td><td>Amerika Serikat</td><td>Hosting, distribusi, dan perutean model AI melalui AI Gateway</td></tr>
          <tr><td>Anthropic, PBC</td><td>Amerika Serikat</td><td>Pembuatan respons AI dan teks pembacaan</td></tr>
          <tr><td>Supabase Pte. Ltd.</td><td>Singapura</td><td>Basis data dan autentikasi</td></tr>
          <tr><td>LINE Yahoo Corporation</td><td>Jepang</td><td>Fungsi berbagi dan koneksi LINE bila digunakan</td></tr>
          <tr><td>Stripe, Inc.</td><td>Amerika Serikat</td><td>Pemrosesan pembayaran</td></tr>
          <tr><td>Resend, Inc.</td><td>Amerika Serikat</td><td>Pengiriman email masuk dan pembelian</td></tr>
          <tr><td>Google LLC</td><td>Amerika Serikat</td><td>Analitik penggunaan</td></tr>
          <tr><td>Cloudflare, Inc.</td><td>Amerika Serikat</td><td>Domain, CDN, dan keamanan</td></tr>
          <tr><td>Meta Platforms, Inc.</td><td>Amerika Serikat</td><td>Pengukuran konversi bila tag terkait aktif</td></tr>
          <tr><td>TikTok Pte. Ltd.</td><td>Singapura</td><td>Pengukuran konversi bila tag terkait aktif</td></tr>
        </tbody>
      </table>
      <p>
        Penanganan data oleh tiap penyedia mengikuti kebijakan privasinya.
        Operator melakukan pengawasan yang diperlukan dan wajar terhadap para
        penyedia tersebut.
      </p>
      <p>
        Untuk mempersonalisasi respons AI, pesan Pengguna dapat dikirim bersama
        nama tampilan, hasil Big Five, tipe 32 karakter, pembacaan yang tersimpan,
        dan bagian percakapan terbaru melalui Vercel AI Gateway kepada penyedia
        model. Nomor kartu dan data pembayaran lengkap tidak dikirim.
      </p>

      <h2>Pasal 6 (Transfer Internasional)</h2>
      <ol>
        <li>Informasi dapat diproses atau disimpan di Jepang, Amerika Serikat, Singapura, atau lokasi penyedia lain.</li>
        <li>
          Sistem perlindungan data di negara tujuan secara umum meliputi:
          <ol>
            <li>Amerika Serikat memiliki aturan federal sektoral dan hukum privasi negara bagian; dan</li>
            <li>Singapura memiliki Personal Data Protection Act (PDPA).</li>
          </ol>
          Perlindungan di lokasi pemrosesan dapat berbeda dari negara Pengguna.
        </li>
        <li>Operator menggunakan kontrak pemrosesan data, koneksi terenkripsi, dan pemeriksaan yang wajar untuk menjaga perlindungan berkelanjutan.</li>
      </ol>

      <h2>Pasal 7 (Cookie dan Teknologi Serupa)</h2>
      <ol>
        <li>Layanan menggunakan Cookie, Local Storage, dan teknologi serupa.</li>
        <li>
          Teknologi tersebut dipakai untuk:
          <ol>
            <li>mengenali sesi dan Pengguna;</li>
            <li>analitik penggunaan dan pengukuran konversi; serta</li>
            <li>menyimpan hasil, preferensi, dan pengaturan kenyamanan.</li>
          </ol>
        </li>
        <li>Pengguna dapat menonaktifkan Cookie melalui browser, tetapi sebagian fungsi mungkin tidak tersedia.</li>
        <li>
          Google Analytics tunduk pada ketentuan Cookie dan kebijakan privasi Google. Pengukuran dapat dinonaktifkan dengan add-on opt-out.
          <ul>
            <li>
              Opt-out Google Analytics:{" "}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
                https://tools.google.com/dlpage/gaoptout
              </a>
            </li>
          </ul>
        </li>
      </ol>

      <h2>Pasal 8 (Pengamanan Informasi)</h2>
      <p>Operator menerapkan langkah berikut untuk mencegah kebocoran, kehilangan, dan kerusakan.</p>
      <ol>
        <li>Enkripsi komunikasi dengan SSL/TLS.</li>
        <li>Pembatasan hak akses basis data dan sistem.</li>
        <li>Pendidikan dan panduan bagi orang yang menangani data.</li>
        <li>Pemantauan berkelanjutan atas perkembangan keamanan.</li>
      </ol>
      <p>Jika terjadi insiden, Operator akan segera mengambil tindakan yang diwajibkan hukum, termasuk pelaporan dan pemberitahuan kepada pihak yang terdampak bila diperlukan.</p>

      <h2>Pasal 9 (Masa Penyimpanan)</h2>
      <ol>
        <li>Informasi disimpan selama diperlukan untuk tujuan pengumpulan.</li>
        <li>Permintaan penghapusan yang sah akan dipenuhi dalam jangka waktu wajar.</li>
        <li>Catatan yang wajib disimpan berdasarkan hukum pajak, akuntansi, konsumen, atau antipenipuan tetap disimpan selama periode yang diwajibkan.</li>
      </ol>

      <h2>Pasal 10 (Akses, Koreksi, Pembatasan, dan Penghapusan)</h2>
      <ol>
        <li>Pengguna dapat meminta akses, koreksi, penambahan, penghapusan, pembatasan penggunaan, penghentian pemberian, penolakan, atau portabilitas sejauh diberikan oleh hukum.</li>
        <li>Operator dapat memverifikasi identitas untuk mencegah penyamaran.</li>
        <li>Permintaan dapat dikirim ke kontak dalam Pasal 13 dan tidak dikenakan biaya oleh Operator.</li>
        <li>Permintaan dapat ditolak seluruhnya atau sebagian bila hukum mengizinkannya; alasannya akan diberitahukan.</li>
        <li>Informasi alamat usaha Operator akan diberikan bila ada permintaan tertulis yang sah.</li>
      </ol>

      <h2>Pasal 11 (Informasi Anak di Bawah Umur)</h2>
      <ol>
        <li>Pengguna di bawah 18 tahun wajib memperoleh persetujuan orang tua atau wali.</li>
        <li>Orang tua atau wali dapat mengajukan permintaan hak privasi untuk anak.</li>
        <li>Operator menangani informasi anak di bawah 13 tahun dengan perhatian khusus.</li>
        <li>Jika Operator mengetahui informasi anak di bawah 13 tahun diperoleh tanpa dasar yang sesuai, informasi tersebut akan dihapus dalam jangka waktu wajar.</li>
      </ol>

      <h2>Pasal 12 (Perubahan Kebijakan)</h2>
      <ol>
        <li>Kebijakan ini dapat diubah mengikuti perubahan hukum atau Layanan.</li>
        <li>Perubahan berlaku ketika dipublikasikan. Perubahan material akan diumumkan dengan cara yang mudah dipahami dan persetujuan baru akan diminta bila diwajibkan hukum.</li>
      </ol>

      <h2>Pasal 13 (Kontak Privasi)</h2>
      <p>Pertanyaan dan permintaan hak privasi dapat dikirim ke:</p>
      <ul>
        <li>Operator: Ryunosuke Futami / Tim Operasional Alice Test</li>
        <li>Email: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a></li>
      </ul>
      <p>Alamat usaha dan informasi lain akan diberikan atas permintaan tertulis yang sah.</p>

      <hr />
      <p>Ditetapkan: 1 Juni 2026</p>
      <p>Terakhir direvisi: 18 September 2026</p>
    </LegalDocument>
  );
}
