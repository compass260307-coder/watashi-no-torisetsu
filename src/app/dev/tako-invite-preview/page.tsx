import { notFound, redirect } from "next/navigation";

export default async function TakoInvitePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ friends?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const friends = (await searchParams).friends;
  if (friends === "1") {
    redirect("/tako/preview?previewType=idea-monkey__R&friends=1");
  }

  redirect("/tako/preview?previewLocked=1&friends=0");
}
