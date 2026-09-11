import type { Metadata } from "next";
import EnResultRedirect from "@/components/en/EnResultRedirect";

export const metadata: Metadata = { title: "Loading your result", robots: { index: false, follow: false } };

export default function EnglishResultPage() { return <EnResultRedirect />; }
