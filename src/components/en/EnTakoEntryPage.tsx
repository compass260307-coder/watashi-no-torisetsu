import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import TakoEntryPage from "@/components/tako/TakoEntryPage";

export default function EnTakoEntryPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <EnSiteHeader />
      <TakoEntryPage locale="en" />
      <EnSiteFooter />
    </div>
  );
}
