import { Metadata } from "next";

export const metadata: Metadata = {
  title: "General Ledger",
};

export default function GeneralLedgerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 