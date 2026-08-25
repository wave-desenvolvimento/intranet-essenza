import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CollectionDetail } from "./collection-detail";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("cms_collections")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!collection) notFound();

  const [fieldsRes, itemsRes] = await Promise.all([
    supabase.from("cms_fields").select("*").eq("collection_id", collection.id).order("sort_order"),
    supabase.from("cms_items").select("*").eq("collection_id", collection.id).order("sort_order"),
  ]);

  return <CollectionDetail collection={collection} fields={fieldsRes.data || []} items={itemsRes.data || []} />;
}
