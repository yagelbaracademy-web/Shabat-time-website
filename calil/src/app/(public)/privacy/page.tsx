import type { Metadata } from "next";
import { Suspense } from "react";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY } from "@/content/legal";

export const metadata: Metadata = { title: "Privacy Policy · Calil" };

export default function Page() {
  return (
    <Suspense>
      <LegalPage doc={PRIVACY} path="/privacy" />
    </Suspense>
  );
}
