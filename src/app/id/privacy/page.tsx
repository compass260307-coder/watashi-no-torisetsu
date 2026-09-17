import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";

export const metadata: Metadata = { title: "Kebijakan Privasi", description: "Cara Alice Test menangani informasi pribadi." };

export default function IndonesianPrivacyPage() {
  return (
    <LegalDocument title="Kebijakan Privasi" lastUpdated="18 September 2026" locale="id">
      <p>Ryunosuke Futami / Tim Operasional Alice Test (“Operator”) menangani informasi pribadi dalam Alice Test (“Layanan”) sebagaimana dijelaskan di bawah.</p>
      <h2>1. Pengendali dan kontak</h2><p>Pengendali: Ryunosuke Futami (Tim Operasional Alice Test), Jepang. Kontak privasi: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>.</p>
      <h2>2. Informasi yang diproses</h2><ul><li>Jawaban tes kepribadian dan penilaian teman, nama panggilan, serta pesan opsional.</li><li>Email untuk tautan masuk, konfirmasi pembelian, dan pemulihan hasil.</li><li>Tanggal, waktu, dan wilayah kelahiran untuk Peta Takdir.</li><li>Pesan kepada Alice dan riwayat percakapan.</li><li>Riwayat pembelian, jumlah, mata uang, status, produk, dan pengenal transaksi Stripe.</li><li>Alamat IP, waktu akses, halaman, perujuk, browser, perangkat, cookie, penyimpanan lokal, peristiwa penggunaan atau kesalahan, serta pengenal kampanye.</li></ul><p>Nomor kartu lengkap diproses langsung oleh Stripe dan tidak disimpan Operator.</p>
      <h2>3. Tujuan</h2><ol><li>Menghitung, menyimpan, dan menampilkan hasil kepribadian serta teman.</li><li>Menghitung peta kelahiran dan membuat Peta Takdir.</li><li>Menyediakan percakapan Alice dan pengalaman tarot.</li><li>Mengirim tautan masuk serta memulihkan hasil dan pembelian.</li><li>Memproses pembayaran, mengirim konten, mencegah tagihan ganda, dan menangani pengembalian dana.</li><li>Menjawab dukungan, menjaga keamanan, mencegah penyalahgunaan, memperbaiki kesalahan, dan mengukur penggunaan.</li></ol>
      <h2>4. Dasar hukum</h2><p>Tergantung hukum yang berlaku, pemrosesan didasarkan pada pelaksanaan kontrak, langkah pra-kontrak yang diminta, kepentingan sah untuk mengoperasikan dan melindungi Layanan, kewajiban hukum, atau persetujuan.</p>
      <h2>5. Penyimpanan dan penghapusan</h2><p>Hasil, penilaian teman, data kelahiran, percakapan, dan hubungan akun biasanya disimpan sampai akun dihapus, permintaan penghapusan yang sah dipenuhi, atau tujuan berakhir. Catatan pembayaran dapat disimpan sesuai kewajiban pajak, akuntansi, konsumen, dan antipenipuan.</p>
      <h2>6. Penyedia layanan</h2><p>Kami memakai Vercel untuk hosting dan permintaan AI, Supabase untuk basis data dan autentikasi, Stripe untuk pembayaran, Resend untuk email, Anthropic untuk pembuatan konten AI, Google untuk analitik, Cloudflare untuk domain dan keamanan, serta Meta/TikTok untuk pengukuran konversi bila tag terkait aktif.</p>
      <h2>7. Transfer internasional</h2><p>Data dapat diproses di Jepang, Amerika Serikat, Singapura, atau lokasi penyedia lain dengan koneksi terenkripsi dan perlindungan yang diwajibkan hukum.</p>
      <h2>8. Pembagian data</h2><p>Kami tidak menjual informasi pribadi. Data hanya dibagikan kepada penyedia di atas, bila diwajibkan hukum, untuk melindungi keselamatan atau hak, atau dalam pengalihan usaha yang sah.</p>
      <h2>9. Cookie dan analitik</h2><p>Cookie dan penyimpanan lokal menjaga sesi, hasil, preferensi, rujukan, dan keamanan. Alat analitik atau iklan dapat memproses data perangkat, halaman, kampanye, dan peristiwa. Bila diwajibkan, tag non-esensial hanya aktif setelah persetujuan.</p>
      <h2>10. Hak pengguna</h2><p>Tergantung lokasi, pengguna dapat meminta akses, koreksi, penghapusan, pembatasan, penolakan, portabilitas, penarikan persetujuan, atau mengajukan keluhan kepada otoritas perlindungan data. Kami dapat memverifikasi identitas.</p>
      <h2>11. Keamanan, anak, dan perubahan</h2><p>Kami memakai kontrol akses, enkripsi saat transit, token hasil rahasia, akses penyedia terbatas, dan pemantauan. Layanan tidak ditujukan kepada anak di bawah 13 tahun tanpa pengawasan. Kebijakan ini dapat diperbarui dan perubahan material akan diumumkan bila diwajibkan.</p>
    </LegalDocument>
  );
}
