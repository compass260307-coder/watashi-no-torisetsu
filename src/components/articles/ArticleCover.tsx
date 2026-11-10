import Image from "next/image";
import { SmoothImage } from "@/components/ui/SmoothImage";

export function hasArticleSceneCover(src: string) {
  return src.startsWith("/article-covers/");
}

export function ArticleCover({
  src,
  alt = "",
  detail = false,
}: {
  src: string;
  alt?: string;
  detail?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={600}
      sizes={
        detail
          ? "(min-width: 784px) 720px, calc(100vw - 64px)"
          : "(min-width: 1144px) 342px, (min-width: 1024px) calc((100vw - 112px) / 3), (min-width: 640px) calc((100vw - 88px) / 2), calc(100vw - 64px)"
      }
      preload={detail}
      className={`block aspect-[2/1] h-auto w-full bg-[#F4F4FE] ${
        detail ? "mx-auto mt-8 max-w-[720px] rounded-2xl" : ""
      }`}
    />
  );
}

export function ArticleDetailCover({ src, alt }: { src: string; alt: string }) {
  if (hasArticleSceneCover(src)) return <ArticleCover src={src} alt={alt} detail />;

  return (
    <div className="mt-8 flex items-center justify-center rounded-2xl bg-[#F4F4FE] px-8 pt-8">
      <SmoothImage
        src={src}
        alt={alt}
        width={1448}
        height={1086}
        priority
        className="h-auto w-full max-w-[440px]"
      />
    </div>
  );
}
