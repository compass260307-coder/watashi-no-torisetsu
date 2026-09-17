import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";
import { FULL_ACCESS_PRICE_JPY } from "@/lib/access-products";

export const metadata: Metadata = {
  title: "Informasi Penjualan dan Pengembalian Dana",
  description: "Informasi penjual, pembayaran, pengiriman, dan pengembalian dana untuk Edisi Lengkap Alice Test.",
};

export default function IndonesianCommercePage() {
  return (
    <LegalDocument title="Informasi Penjualan dan Pengembalian Dana" lastUpdated="18 September 2026" locale="id">
      <p>Halaman ini menjelaskan penjual dan ketentuan transaksi untuk konten berbayar Alice Test versi Bahasa Indonesia.</p>
      <h2>Penjual dan penanggung jawab</h2><p>Ryunosuke Futami (Tim Operasional Alice Test), Jepang.</p>
      <h2>Alamat dan telepon</h2><p>Akan diberikan tanpa penundaan jika diminta. Hubungi kami melalui email sebelum membeli.</p>
      <h2>Kontak</h2><p><a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>. Kami biasanya membalas dalam tiga hari kerja.</p>
      <h2>Produk dan harga</h2>
      <ul><li>Alice Test — Edisi Lengkap: ¥{FULL_ACCESS_PRICE_JPY.toLocaleString("ja-JP")}, termasuk pajak</li><li>Pembayaran satu kali; tanpa langganan, perpanjangan otomatis, atau pembayaran tambahan wajib</li></ul>
      <p>Jumlah akhir ditampilkan kembali di Stripe Checkout sebelum pembayaran.</p>
      <h2>Yang termasuk</h2>
      <ul><li>Laporan kepribadian lengkap dan PDF pribadi</li><li>Sudut pandang teman dan analisis kecocokan</li><li>Peta Takdir</li><li>30 jawaban dari astrolog AI pribadi Alice</li><li>Ketiga pembacaan tarot Alice</li></ul>
      <h2>Biaya tambahan</h2><p>Pengguna menanggung biaya internet dan data yang diperlukan untuk memakai layanan.</p>
      <h2>Metode, waktu pembayaran, dan pengiriman</h2>
      <ol><li>Metode yang tampil di Stripe Checkout dapat digunakan; ketersediaan bergantung pada perangkat, negara, dan Stripe.</li><li>Pembayaran dikonfirmasi saat checkout selesai. Akses langsung dibuka setelah konfirmasi; metode tertunda dibuka setelah Stripe menyatakan pembayaran berhasil.</li><li>Konfirmasi pembelian dan petunjuk pemulihan dikirim ke email checkout.</li><li>Pembuatan Peta Takdir dimulai setelah data kelahiran dimasukkan dan dapat memerlukan sekitar satu menit.</li></ol>
      <h2>Pembatalan dan garansi uang kembali 30 hari</h2>
      <ol><li>Pengembalian dana penuh dapat diminta dalam 30 hari sejak tanggal pembayaran.</li><li>Kirim email ke alamat dukungan dengan email pembayaran, tanggal, nama produk, dan permintaan yang jelas. Alasan bersifat opsional.</li><li>Garansi berlaku satu kali untuk setiap transaksi.</li><li>Setelah diverifikasi, pengembalian dana yang sah biasanya kami mulai melalui Stripe dalam tiga hari kerja.</li><li>Setelah pengembalian dana penuh selesai, akses berbayar dari pembelian tersebut berakhir.</li><li>Kami dapat meminta verifikasi identitas atau transaksi jika ada dugaan penipuan, pembayaran tanpa izin, atau penyalahgunaan.</li><li>Hak wajib berdasarkan hukum yang berlaku tidak dibatasi.</li></ol>
      <h2>Pembelian oleh anak di bawah umur</h2><p>Pengguna di bawah umur harus memperoleh persetujuan orang tua atau wali sah sebelum membeli.</p>
      <h2>Lingkungan yang disarankan</h2><p>Gunakan versi terbaru browser utama seperti Safari atau Chrome.</p>
      <h2>Keluhan dan sengketa</h2><p>Hubungi kami lebih dahulu melalui email di atas. Hak untuk memakai prosedur penyelesaian sengketa konsumen yang tersedia tetap berlaku.</p>
    </LegalDocument>
  );
}
