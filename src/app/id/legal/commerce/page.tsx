import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";
import {
  formatIdrMinor,
  ID_FULL_ACCESS_PRICE_IDR_MINOR,
} from "@/lib/access-products";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Informasi Penjualan dan Pengembalian Dana",
  description:
    "Informasi penjual, pembayaran, pengiriman, dan pengembalian dana untuk Edisi Lengkap Alice Test.",
  alternates: localizedAlternates(
    "id",
    "/legal/commerce",
    "/ko/legal/commerce",
    "/en/legal/commerce",
    "/id/legal/commerce",
  ),
  robots: { index: true, follow: true },
};

export default function IndonesianCommercePage() {
  return (
    <LegalDocument
      title="Informasi Penjualan dan Pengembalian Dana"
      lastUpdated="18 September 2026"
      locale="id"
    >
      <p>
        Halaman ini menjelaskan penjual dan ketentuan transaksi untuk konten
        berbayar Alice Test versi Bahasa Indonesia.
      </p>

      <h2>Penjual</h2>
      <p>Ryunosuke Futami (Tim Operasional Alice Test).</p>

      <h2>Penanggung Jawab Operasional</h2>
      <p>Ryunosuke Futami.</p>

      <h2>Alamat</h2>
      <p>
        Akan diberikan tanpa penundaan jika diminta. Kirim permintaan melalui
        alamat email dukungan di bawah.
      </p>

      <h2>Nomor Telepon</h2>
      <p>
        Akan diberikan tanpa penundaan jika diminta. Hubungi kami melalui email
        sebelum membeli.
      </p>

      <h2>Kontak</h2>
      <ul>
        <li>
          Email: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>
        </li>
      </ul>
      <p>Kami biasanya membalas dalam tiga hari kerja.</p>

      <h2>Produk dan Harga</h2>
      <ul>
        <li>
          Alice Test - Edisi Lengkap: {formatIdrMinor(ID_FULL_ACCESS_PRICE_IDR_MINOR)},
          termasuk pajak, pembelian satu kali, dan tanpa langganan.
        </li>
      </ul>
      <p>Edisi Lengkap mencakup:</p>
      <ul>
        <li>hasil tes kepribadian lengkap dan buku cerita pribadi 16 halaman;</li>
        <li>penilaian teman, laporan analisis teman, dan kecocokan;</li>
        <li>Peta Takdir;</li>
        <li>
          30 jawaban dari astrolog AI pribadi Alice dan ketiga pembacaan tarot
          Alice.
        </li>
      </ul>
      <p>Jumlah akhir ditampilkan kembali di Stripe Checkout sebelum pembayaran.</p>

      <h2>Biaya Selain Harga Produk</h2>
      <p>
        Pengguna menanggung biaya koneksi internet dan data yang diperlukan untuk
        menggunakan Layanan.
      </p>

      <h2>Metode Pembayaran</h2>
      <p>
        Metode yang tampil di Stripe Checkout dapat digunakan. Ketersediaannya
        bergantung pada perangkat, negara, dan dukungan Stripe.
      </p>

      <h2>Waktu Pembayaran</h2>
      <p>
        Pembayaran dikonfirmasi ketika Checkout selesai. Untuk metode pembayaran
        tertunda, pembayaran dianggap selesai setelah Stripe mengonfirmasi
        keberhasilannya.
      </p>

      <h2>Waktu Penyediaan Produk</h2>
      <ol>
        <li>Akses digital dibuka segera setelah pembayaran dikonfirmasi.</li>
        <li>Konfirmasi pembelian dan petunjuk pemulihan dikirim ke email Checkout.</li>
        <li>Pembuatan Peta Takdir dimulai setelah data kelahiran dimasukkan dan dapat memerlukan sekitar satu menit.</li>
      </ol>

      <h2>Pembatalan, Pengembalian Dana, dan Garansi 30 Hari</h2>
      <ol>
        <li>Pengembalian dana penuh dapat diminta dalam 30 hari sejak tanggal pembayaran.</li>
        <li>Kirim email pembayaran, tanggal, nama produk, dan permintaan yang jelas ke alamat dukungan. Alasan bersifat opsional.</li>
        <li>Garansi berlaku satu kali untuk setiap transaksi.</li>
        <li>Setelah diverifikasi, pengembalian dana yang sah biasanya dimulai melalui Stripe dalam tiga hari kerja.</li>
        <li>Setelah pengembalian dana penuh selesai, akses berbayar dari pembelian tersebut berakhir.</li>
        <li>Operator dapat meminta verifikasi identitas atau transaksi bila ada dugaan penipuan, pembayaran tanpa izin, atau penyalahgunaan.</li>
        <li>Hak wajib berdasarkan hukum yang berlaku tidak dibatasi.</li>
      </ol>

      <h2>Lingkungan Operasi</h2>
      <p>
        Gunakan versi terbaru browser utama seperti Safari atau Chrome dengan
        JavaScript dan Cookie yang diperlukan diaktifkan.
      </p>

      <h2>Ketentuan Penjualan Khusus</h2>
      <ul>
        <li>Pengguna di bawah umur wajib memperoleh persetujuan orang tua atau wali sebelum membeli.</li>
        <li>Konten tes, AI, astrologi, dan tarot ditujukan untuk hiburan dan refleksi, bukan nasihat profesional.</li>
        <li>Jika terjadi keluhan atau sengketa, hubungi dukungan terlebih dahulu. Hak memakai prosedur perlindungan konsumen yang tersedia tetap berlaku.</li>
      </ul>
    </LegalDocument>
  );
}
