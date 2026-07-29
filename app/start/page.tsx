import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Wizard } from "@/components/Wizard";

export const metadata = {
  title: "Build your roadmap — Ascent",
  description: "Eight questions. A month-by-month career transition plan.",
};

export default function StartPage() {
  return (
    <>
      <SiteHeader cta={false} />
      <main className="container-page py-14 sm:py-20">
        <Suspense
          fallback={
            <div className="mx-auto h-64 w-full max-w-2xl animate-pulseSoft rounded-3xl bg-paper-deep/50" />
          }
        >
          <Wizard />
        </Suspense>
      </main>
    </>
  );
}
