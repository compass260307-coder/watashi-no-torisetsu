import type { UnlockPeek } from "@/components/result/PaywallPeek";
import { formatIdrMinor, ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR, ID_FULL_ACCESS_PRICE_IDR_MINOR } from "@/lib/access-products";
import { peeks } from "../peeks/id";
import { peeks as basePeeks } from "../peeks/ja";
import type { FooterContent, HeaderContent, PlanDefinition, UiCopy, UnlockItem } from "../types";
import labels from "./id-labels";
const header: HeaderContent = {
  siteName: "Alice Test",
  homeHref: "/id",
  nav: [
    {
      label: "Tes kepribadian", href: "/id/diagnosis"
    },
    {
      label: "Tes dari teman", href: "/id/tako", tako: true
    },
    {
      label: "Tipe kepribadian", href: "/id/types"
    },
    {
      label: "Kecocokan", href: "/id/aisho"
    },
    {
      label: "Alice", href: "/id/hoshiyomi", course: "astrologer"
    },
    {
      label: "Tarot", href: "/id/tarot"
    },
    {
      label: "Masuk", href: "/id/login", login: true
    },
  ],
  preparing: " (Segera hadir)",
  currentLangLabel: "Bahasa Indonesia",
  languageOptions: [
    {
      locale: "ja", localLabel: "Bahasa Jepang", nativeLabel: "日本語"
    },
    {
      locale: "en", localLabel: "Bahasa Inggris", nativeLabel: "English"
    },
    {
      locale: "ko", localLabel: "Bahasa Korea", nativeLabel: "한국어"
    },
  ],
  languageModalTitle: "Bahasa",
  ariaLangSwitch: "Ganti bahasa",
  ariaLangMenuClose: "Tutup menu bahasa",
  menuTitle: "Menu",
  ariaMenuOpen: "Buka menu",
  ariaMenuClose: "Tutup menu",
  reset: {
    label: "Reset data lokal",
    confirm: "Hasil tes dan tautan undangan akan dihapus dari perangkat ini. Tindakan ini tidak dapat dibatalkan.",
    run: "Reset",
    cancel: "Batal",
  },
};
const footer: FooterContent = {
  columns: [
    {
      title: "Tes",
      links: [
        {
          label: "Tes kepribadian", href: "/id/diagnosis"
        },
        {
          label: "Tes dari teman", href: "/id/tako", tako: true
        },
        {
          label: "Tipe kepribadian", href: "/id/types"
        },
        {
          label: "Kecocokan", href: "/id/aisho"
        },
        {
          label: "Alice", href: "/id/hoshiyomi", course: "astrologer"
        },
        {
          label: "Peta Takdir", href: "/id/unmei", course: "unmei"
        },
        {
          label: "Tarot Alice", href: "/id/tarot", course: "tarot"
        },
      ],
    },
    {
      title: "Layanan",
      links: [
        {
          label: "Tentang layanan", href: "/id/about"
        },
        {
          label: "Artikel", href: "/id/articles"
        },
        {
          label: "Perusahaan", href: "https://sora-team.com", external: true, newTab: true
        },
      ],
    },
    {
      title: "Dukungan",
      links: [
        {
          label: "Hubungi kami", href: "mailto:support@watashi-torisetsu.com", external: true
        },
      ],
    },
  ],
  legalLinks: [
    {
      label: "Ketentuan", href: "/id/terms"
    },
    {
      label: "Kebijakan Privasi", href: "/id/privacy"
    },
    {
      label: "Informasi Penjualan & Pengembalian Dana", href: "/id/legal/commerce"
    },
  ],
  legalAriaLabel: "Informasi hukum",
  copyright: "Alice Test",
  disclaimer: "Alice Test adalah pengalaman kepribadian berdasarkan model Big Five dan penilaian teman. Hasilnya ditujukan untuk refleksi diri, bukan diagnosis medis atau psikologis.",
  preparing: " (Segera hadir)",
  takoBaseHref: "/id/tako",
};
const ID_SELF_UNLOCKS: UnlockItem[] = [
  {
    title: "Buka semua 9 bagian hasil yang terkunci",
    desc: "Baca seluruh kelanjutan hasilmu, dari cinta dan karier hingga kesan orang lain dan responsmu dalam berbagai situasi.",
  },
  {
    title: "Ebook pribadi dengan 16+ halaman",
    desc: "Kepribadian dan ciri khasmu dirangkum menjadi satu buku yang dapat disimpan, dicetak, dan dibaca kapan saja.",
  },
  {
    title: "Chat dengan Alice, astrolog pribadimu",
    desc: "Alice memahami kepribadian dan peta kelahiranmu, lalu membantumu membahas cinta, pekerjaan, dan hubungan.",
  },
  {
    title: "Buka semua ramalan Alice",
    desc: "Dapatkan Peta Takdir pribadi serta tarot satu kartu, tiga kartu, dan YA / TIDAK.",
  },
  {
    title: "Buka seluruh analisis kecocokan",
    desc: "Pelajari kecocokan cinta, persahabatan, dan pekerjaan, termasuk titik rawan salah paham.",
  },
  {
    title: "Buka semua hasil teman setelah teman pertama",
    desc: "Baca lembar hasil lengkap setiap teman, termasuk karakter, perbedaan persepsi, kecenderungan cinta, dan kecocokan.",
  },
  {
    title: "Perbarui laporan sudut pandang teman kapan saja",
    desc: "Gabungkan semua jawaban menjadi satu PDF lengkap dan buat ulang setiap kali ada teman baru yang menjawab.",
  },
];
const ID_TAKO_UNLOCKS: UnlockItem[] = [
  ID_SELF_UNLOCKS[5],
  ID_SELF_UNLOCKS[6],
  ID_SELF_UNLOCKS[2],
  ID_SELF_UNLOCKS[3],
  ID_SELF_UNLOCKS[4],
  ID_SELF_UNLOCKS[0],
  ID_SELF_UNLOCKS[1],
];
const ID_UNMEI: UnlockItem = {
  title: "Peta Takdir pribadimu",
  desc: "Pembacaan AI empat bab yang menggabungkan profil kepribadian dan peta kelahiran, plus tiga jenis tarot Alice.",
};
const ID_FULL_ACCESS_ITEMS = [
  "Buka semua 9 bagian hasil kepribadian yang terkunci",
  "Ebook pribadi dengan 16+ halaman",
  "Buka semua hasil teman setelah teman pertama",
  "Perbarui PDF sudut pandang teman kapan saja",
  "Buka seluruh analisis kecocokan",
  "Peta Takdir pribadimu",
  "30 jawaban dari astrolog pribadimu, Alice",
  "Buka ketiga pembacaan tarot Alice",
] as const;
const ID_PLANS: readonly PlanDefinition[] = [
  {
    product: "full_access",
    eyebrow: "Kepribadian, teman, dan Alice",
    title: "Edisi Lengkap",
    basePrice: ID_FULL_ACCESS_PRICE_IDR_MINOR,
    listPrice: ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR,
    iconSrc: "/pricing/full-access-connection-felt-transparent.png",
    accent: "#5B5BEF",
    soft: "#EEEEFF",
    inheritedItemCount: 0,
    items: ID_FULL_ACCESS_ITEMS,
  },
] as const;
function peekForItem(): UnlockPeek | undefined {
  // The Indonesian plan list does not expose sample previews.
  return undefined;
}
const copy: UiCopy = {
  koreanLegal: {
    "before": "", "terms": "", "privacy": "", "commerce": "", "after": ""
  }, nav: {
    "me": "Hasil saya", "friend": "Teman", "astrologer": "Alice", "unmei": "Takdir", "tarot": "Tarot"
  }, loading: ["Memuat…", "Tutup", "Gagal dimuat. Memuat ulang dapat menghapus jawaban yang belum disimpan.", "Muat ulang"], lock: {
    friend: {
      ariaLabel: "Tes teman terkunci",
      heading: "Tes teman masih terkunci",
      bodyLine1: "Selesaikan tes kepribadianmu",
      bodyLine2: "untuk mengundang teman menilaimu.",
    },
    astrologer: {
      ariaLabel: "Alice terkunci",
      heading: "Alice masih terkunci",
      bodyLine1: "Selesaikan tes kepribadianmu",
      bodyLine2: "untuk membuka Edisi Lengkap.",
    },
    unmei: {
      ariaLabel: "Peta Takdir terkunci",
      heading: "Peta Takdir masih terkunci",
      bodyLine1: "Selesaikan tes kepribadianmu",
      bodyLine2: "untuk membuka Edisi Lengkap.",
    },
    tarot: {
      ariaLabel: "Tarot terkunci",
      heading: "Tarot masih terkunci",
      bodyLine1: "Selesaikan tes kepribadianmu",
      bodyLine2: "untuk membuka pembacaan tarot.",
    },
  }, labels, header, footer, peeks, basePeeks,
  promo: {
    heading: ["Kisahmu belum", "selesai"], studentHeading: ["Kisahmu belum", "selesai"], studentCta: "Buka Edisi Lengkap →", price: {
      list: formatIdrMinor(ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR),
      sale: formatIdrMinor(ID_FULL_ACCESS_PRICE_IDR_MINOR),
      offPercent: Math.round((1 -
        ID_FULL_ACCESS_PRICE_IDR_MINOR /
        ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR) *
        100),
    }, selfReportPrice: formatIdrMinor(ID_FULL_ACCESS_PRICE_IDR_MINOR), self: ID_SELF_UNLOCKS, tako: ID_TAKO_UNLOCKS, studentSelf: ID_SELF_UNLOCKS, studentTako: ID_TAKO_UNLOCKS, alice: ID_SELF_UNLOCKS[2], fortune: ID_SELF_UNLOCKS[3], unmei: ID_UNMEI
  },
  carousel: {
    peekForItem, ctaLabel: (product) => { return product === "full_access" ? "Buka Edisi Lengkap →" : "Buka sekarang →"; }, plans: ID_PLANS, premiumFeatures: [
      {
        title: "Pembacaan AI empat bab",
        desc: "Baca kisahmu dari perjalanan masa lalu hingga titik balik yang akan datang.",
      },
      {
        title: "30 jawaban dari astrolog pribadimu",
        desc: "Minta panduan dari astrolog yang memahami kepribadian dan peta kelahiranmu.",
      },
      {
        title: "Roda peta kelahiran pribadi",
        desc: "Lihat susunan langit saat kamu lahir sebagai peta pribadi.",
      },
      {
        title: "Kepribadian dan astrologi dalam satu analisis",
        desc: "Pahami dirimu lebih dalam melalui sifat kepribadian dan astrologimu.",
      },
      {
        title: "Buka analisis kecocokan",
        desc: "Lihat peringkat kecocokan S sampai C untuk cinta, persahabatan, dan pekerjaan.",
      },
    ]
  },
};
export default copy;
