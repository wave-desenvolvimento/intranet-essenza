import { getCollectionsFull } from "./actions";
import { getPages } from "./pages-actions";
import { CmsShell } from "./cms-shell";

export default async function CmsPage() {
  const [collections, pages] = await Promise.all([
    getCollectionsFull(),
    getPages(),
  ]);
  return <CmsShell collections={collections} pages={pages} />;
}
