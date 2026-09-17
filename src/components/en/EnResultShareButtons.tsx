"use client";

import { useState } from "react";
import { track } from "@/lib/track";

export default function EnResultShareButtons({
  shareUrl,
  typeName,
}: {
  shareUrl: string;
  typeName: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  const text = `My personality type is ${typeName}. What is yours?`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  const record = (channel: "native" | "x" | "facebook" | "copy") =>
    track("share_clicked", {
      metadata: { channel, kind: "character", source: "en_result" },
    });

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${typeName} | Alice Personalities`,
          text,
          url: shareUrl,
        });
        record("native");
        return;
      } catch {
        return;
      }
    }
    await copy();
  }

  async function copy() {
    const shareText = `${text}\n${shareUrl}`;
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(shareText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
      record("copy");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareText;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const succeeded = document.execCommand("copy");
      textarea.remove();
      if (succeeded) {
        setCopyState("copied");
        window.setTimeout(() => setCopyState("idle"), 1800);
        record("copy");
      } else {
        setCopyState("manual");
      }
    }
  }

  const buttonClass =
    "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-extrabold transition-transform hover:-translate-y-0.5";
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <button
          type="button"
          onClick={share}
          className={`${buttonClass} bg-[#5B5BEF] text-white`}
        >
          Share my type
        </button>
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => record("x")}
          className={`${buttonClass} bg-black text-white`}
        >
          Share on X
        </a>
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => record("facebook")}
          className={`${buttonClass} bg-[#1877F2] text-white`}
        >
          Share on Facebook
        </a>
        <button
          type="button"
          onClick={copy}
          className={`${buttonClass} border-2 border-[#5B5BEF] bg-white text-[#5B5BEF]`}
        >
          {copyState === "copied"
            ? "Link copied"
            : copyState === "manual"
              ? "Select link below"
              : "Copy link"}
        </button>
      </div>
      {copyState === "manual" ? (
        <input
          aria-label="Share link"
          readOnly
          value={shareUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="mx-auto mt-3 block w-full max-w-xl rounded-xl border border-[#C8CBE0] bg-white px-4 py-3 text-sm text-[#41415F]"
        />
      ) : null}
    </div>
  );
}
