import type { Metadata } from "next";
import { LandingShell } from "@/components/landing/LandingShell";
import { FAQ } from "@/components/landing/faq";

const TITLE = "GymGrid: QR check in, bKash and Nagad billing for your front desk";
const DESCRIPTION =
  "Replace the paper register at your gym. Members check in with a printed QR, bKash and Nagad TrxIDs land in one queue, and renewals come with a WhatsApp reminder.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, images: ["/images/screens/preview-desktop.png"] },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <LandingShell />
    </>
  );
}
