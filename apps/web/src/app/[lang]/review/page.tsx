import type { Metadata } from "next";
import { ReviewReports } from "@/components/reviewReports";

export const metadata: Metadata = { title: "Shared reports", robots: { index: false } };

export default function ReviewPage() {
  return <ReviewReports />;
}
