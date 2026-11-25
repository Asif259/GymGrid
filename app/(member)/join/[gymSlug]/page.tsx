import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { JoinGymClient } from "@/components/member/JoinGymClient";
import type { PublicGym } from "@/types/gym";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gymSlug: string }>;
}): Promise<Metadata> {
  const { gymSlug } = await params;
  return {
    title: `Join ${gymSlug}`,
  };
}

export default async function JoinGymSlugPage({
  params,
}: {
  params: Promise<{ gymSlug: string }>;
}) {
  const { gymSlug } = await params;
  let initialGym: PublicGym | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_public_gym_by_slug", {
      p_slug: gymSlug,
    });
    if (data && typeof data === "object") {
      initialGym = data as PublicGym;
    }
  } catch {
    // Client component re-fetches if SSR lookup fails
  }

  return <JoinGymClient gymSlug={gymSlug} initialGym={initialGym} />;
}
