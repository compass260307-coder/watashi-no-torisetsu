import type { Metadata } from "next";
import { LocalizedNotFound } from "@/components/LocalizedNotFound";

export const metadata: Metadata = {
  title: { absolute: "404" },
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <LocalizedNotFound />;
}
