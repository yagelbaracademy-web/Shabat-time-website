import type { Metadata } from "next";
import { Suspense } from "react";
import { LegalPage } from "@/components/LegalPage";
import { ACCESSIBILITY } from "@/content/legal";

export const metadata: Metadata = { title: "Accessibility · Calil" };

export default function Page() {
  return (
    <Suspense>
      <LegalPage doc={ACCESSIBILITY} path="/accessibility" />
    </Suspense>
  );
}
