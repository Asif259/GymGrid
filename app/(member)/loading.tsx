import { Skeleton } from "@/components/ui/skeleton";

export default function MemberLoading() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 sm:p-6">
      <Skeleton className="h-8 w-44 rounded-xl" />
      <Skeleton className="h-44 rounded-3xl" />
      <Skeleton className="h-52 rounded-3xl" />
    </main>
  );
}
