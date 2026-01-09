import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start Guided Trial • CAIO",
  description:
    "Start a guided trial of CAIO. Upload a real business file and receive a unified, rule-grounded executive action plan. No prompt engineering. Pay-as-you-go credits.",
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
