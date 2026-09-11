import TopFooter from "@/components/top/TopFooter";

export default function EnSiteFooter({
  topBorder = true,
}: {
  topBorder?: boolean;
}) {
  return <TopFooter locale="en" topBorder={topBorder} />;
}
