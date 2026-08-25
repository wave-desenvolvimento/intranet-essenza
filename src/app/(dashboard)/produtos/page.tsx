import { createClient } from "@/lib/supabase/server";
import { ProductsManager } from "./products-manager";

export default async function ProductsPage() {
  const supabase = await createClient();

  const [productsRes, categoriesRes] = await Promise.all([
    supabase
      .from("products")
      .select("*, prices:product_prices(*), product_category:product_categories(id, name)")
      .order("sort_order"),
    supabase
      .from("product_categories")
      .select("*")
      .order("sort_order"),
  ]);

  return <ProductsManager products={productsRes.data || []} categories={categoriesRes.data || []} />;
}
