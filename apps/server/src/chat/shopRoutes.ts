import { signedIn, t } from "../trpc";
import { productDetail, productQuery } from "./shopTools";

export const shopRoutes = {
  shop: t.router({
    product: signedIn.input(productQuery).query(({ input }) => productDetail(input)),
  }),
};
