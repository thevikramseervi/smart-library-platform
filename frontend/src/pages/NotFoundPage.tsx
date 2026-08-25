import { BookOpen } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export function NotFoundPage() {
  return (
    <EmptyState
      icon={BookOpen}
      message="This page does not exist. Check the address or head back to your dashboard."
      actionLabel="Go to dashboard"
      actionTo="/dashboard"
      className="py-16"
    />
  );
}
