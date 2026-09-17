import Link from "next/link";

export default function IdSiteFooter() {
  return (
    <footer className="border-t border-[#E6E6F0] bg-white px-5 py-10 text-[#2E2E5C]">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-lg font-black">Alice Test</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#6E6E84]">
            Tes kepribadian gratis berdasarkan model Big Five. Hasil ini ditujukan untuk hiburan dan refleksi diri, bukan diagnosis medis atau psikologis.
          </p>
        </div>
        <nav aria-label="Tautan footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[#5B5BEF]">
          <Link href="/id/diagnosis">Ikuti tes</Link>
          <Link href="/id/types">32 tipe</Link>
          <a href="mailto:support@watashi-torisetsu.com">Hubungi kami</a>
        </nav>
      </div>
    </footer>
  );
}
