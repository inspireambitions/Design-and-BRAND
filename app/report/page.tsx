import { ReportView } from "@/components/report/ReportView";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Your roadmap — Ascent",
  description: "Your personalized career transition plan.",
};

export default function ReportPage() {
  return (
    <>
      <SiteHeader cta={false} />
      <ReportView />
    </>
  );
}
