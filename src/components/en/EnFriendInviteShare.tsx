"use client";

import { useState } from "react";
import { track } from "@/lib/track";

export default function EnFriendInviteShare({
  inviteUrl,
  inviteCode,
}: {
  inviteUrl: string;
  inviteCode: string;
}) {
  const [copied, setCopied] = useState(false);
  const text =
    "How do you see me? Answer 30 quick questions and compare your view with mine.";
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(inviteUrl)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`;

  function record(channel: "native" | "x" | "facebook" | "copy") {
    track("friend_invite_clicked", {
      inviteCode,
      metadata: { locale: "en", surface: "tako", channel },
    });
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "How do you see me?",
          text,
          url: inviteUrl,
        });
        record("native");
      } catch {
        // The user cancelled the native share sheet.
      }
      return;
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n${inviteUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      record("copy");
    } catch {
      window.prompt("Copy this invite link:", inviteUrl);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <button
        type="button"
        onClick={share}
        className="rounded-full bg-[#5B5BEF] px-7 py-3.5 font-bold text-white"
      >
        Invite a friend
      </button>
      <button
        type="button"
        onClick={copy}
        className="rounded-full border border-[#5B5BEF]/30 px-7 py-3.5 font-bold text-[#5B5BEF]"
      >
        {copied ? "Link copied!" : "Copy link"}
      </button>
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => record("x")}
        className="rounded-full bg-black px-7 py-3.5 text-center font-bold text-white"
      >
        Share on X
      </a>
      <a
        href={facebookUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => record("facebook")}
        className="rounded-full bg-[#1877F2] px-7 py-3.5 text-center font-bold text-white"
      >
        Share on Facebook
      </a>
    </div>
  );
}
