import { getProducts, getProductCategories } from "@/app/(dashboard)/novo-pedido/actions";
import { ProductsManager } from "./products-manager";

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([getProducts(), getProductCategories()]);
  return <ProductsManager products={products} categories={categories} />;
}
