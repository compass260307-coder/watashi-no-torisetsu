import Image from "next/image";
import Link from "next/link";

interface Props {
  inviteHref: string;
}

export default function EmptyPerceptions({ inviteHref }: Props) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-white px-5 py-10">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-2xl font-extrabold text-foreground mb-8">
          🐧 友達からの印象
        </h1>

        <div className="w-40 h-40 mx-auto mb-6">
          <Image
            src="/types/penguin-base.png"
            alt=""
            width={160}
            height={160}
            priority
            className="w-full h-full object-contain"
          />
        </div>

        <h2 className="text-lg font-bold text-foreground mb-3">
          まだ友達に評価してもらってないみたい
        </h2>

        <p className="text-sm text-muted leading-relaxed mb-8">
          友達が評価してくれると、ここに
          <br />
          あなたへの印象が集まります✨
        </p>

        <Link
          href={inviteHref}
          className="inline-block w-full rounded-full bg-primary-gradient px-6 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          友達を招待する →
        </Link>
      </div>
    </main>
  );
}
