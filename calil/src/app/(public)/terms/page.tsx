import type { Metadata } from "next";
import { Suspense } from "react";
import { LegalPage } from "@/components/LegalPage";
import { TERMS } from "@/content/legal";

export const metadata: Metadata = { title: "Terms of Use · Calil" };

export default function Page() {
  return (
    <Suspense>
      <LegalPage doc={TERMS} path="/terms" />
    </Suspense>
  );
}
