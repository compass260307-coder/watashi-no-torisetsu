import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";
import {
  formatIdrMinor,
  ID_FULL_ACCESS_PRICE_IDR_MINOR,
} from "@/lib/access-products";

export const metadata: Metadata = { title: "Ketentuan Layanan", description: "Ketentuan penggunaan Alice Test versi Bahasa Indonesia." };

export default function IndonesianTermsPage() {
  return (
    <LegalDocument title="Ketentuan Layanan" lastUpdated="18 September 2026" locale="id">
      <p>Ketentuan ini mengatur penggunaan Alice Test (“Layanan”) yang disediakan oleh Ryunosuke Futami / Tim Operasional Alice Test (“Operator”). Dengan memakai Layanan, pengguna menyetujui ketentuan ini.</p>
      <h2>1. Ruang lingkup</h2><ol><li>Ketentuan ini berlaku pada hubungan antara pengguna dan Operator.</li><li>Pemberitahuan serta kebijakan yang ditampilkan dalam Layanan menjadi bagian dari ketentuan ini.</li><li>Hukum perlindungan konsumen yang wajib berlaku akan didahulukan.</li></ol>
      <h2>2. Layanan</h2><p>Layanan menyediakan tes kepribadian berbasis Big Five, hasil 32 tipe karakter, sudut pandang teman, kecocokan, astrologi, tarot, dan percakapan yang dibuat AI. Tes dasar dapat dipakai tanpa akun; email dapat dipakai untuk memulihkan hasil dan pembelian.</p>
      <h2>3. Tautan hasil dan akses akun</h2><ol><li>Pengguna bertanggung jawab menjaga email dan tautan hasil pribadi.</li><li>Pengguna harus memberikan informasi yang akurat dan tidak memakai informasi orang lain tanpa izin.</li><li>Laporkan akses tanpa izin ke alamat dukungan.</li></ol>
      <h2>4. Anak dan pengguna di bawah umur</h2><p>Pengguna di bawah umur wajib memperoleh persetujuan orang tua atau wali sebelum membeli. Anak di bawah 13 tahun hanya boleh memakai Layanan dengan pengawasan.</p>
      <h2>5. Larangan</h2><ol><li>Melanggar hukum atau hak pihak lain.</li><li>Menyamar, memperoleh tautan atau akses secara curang.</li><li>Mengganggu Layanan, mengeksploitasi celah, atau mencoba akses tanpa izin.</li><li>Melakukan scraping, rekayasa balik, otomatisasi akses, atau eksploitasi komersial tanpa izin.</li><li>Melecehkan, mencemarkan nama baik, atau memberi tekanan tidak semestinya kepada pengguna lain.</li></ol>
      <h2>6. Konten berbayar</h2><p>Edisi Lengkap berharga {formatIdrMinor(ID_FULL_ACCESS_PRICE_IDR_MINOR)} termasuk pajak dan merupakan pembelian satu kali. Jumlah serta metode akhir ditampilkan di Stripe Checkout. Akses digital diberikan setelah pembayaran dikonfirmasi.</p>
      <h2>7. Pengembalian dana</h2><p>Permintaan pengembalian dana penuh dapat diajukan dalam 30 hari sesuai <a href="/id/legal/commerce">Informasi Penjualan dan Pengembalian Dana</a>.</p>
      <h2>8. AI, astrologi, dan tarot</h2><p>Konten bersifat hiburan dan refleksi, bukan diagnosis atau nasihat medis, hukum, keuangan, atau profesional. Hasil AI dapat mengandung kesalahan dan tidak menjamin masa depan.</p>
      <h2>9. Hak kekayaan intelektual</h2><p>Hak atas Layanan, teks, desain, karakter, gambar, perangkat lunak, dan merek dimiliki Operator atau pemberi lisensinya. Penggunaan pribadi yang wajar diperbolehkan; penggunaan komersial memerlukan izin.</p>
      <h2>10. Penangguhan dan perubahan</h2><p>Operator dapat mengubah atau menangguhkan Layanan untuk pemeliharaan, keamanan, hukum, atau alasan operasional yang wajar, dan akan memberi pemberitahuan yang sesuai jika memungkinkan.</p>
      <h2>11. Tanggung jawab</h2><p>Sepanjang diizinkan hukum, Operator tidak bertanggung jawab atas kerugian tidak langsung atau konsekuensial. Tidak ada bagian yang mengecualikan tanggung jawab yang tidak boleh dikecualikan oleh hukum.</p>
      <h2>12. Hukum dan kontak</h2><p>Ketentuan ini tunduk pada hukum Jepang tanpa membatasi hak konsumen wajib di tempat pengguna. Hubungi <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>.</p>
    </LegalDocument>
  );
}
