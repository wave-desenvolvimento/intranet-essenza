import { notFound } from "next/navigation";
import { getCollection, getFields, getItems } from "../actions";
import { CollectionDetail } from "./collection-detail";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollection(slug);

  if (!collection) notFound();

  const [fields, items] = await Promise.all([
    getFields(collection.id),
    getItems(collection.id),
  ]);

  return <CollectionDetail collection={collection} fields={fields} items={items} />;
}
