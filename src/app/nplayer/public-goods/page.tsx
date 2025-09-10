import type { Metadata } from "next";
import { PublicGoodsExperience } from "@/components/arena/public-goods-play";

export const metadata: Metadata = {
  title: "Public Goods",
  description:
    "Contribute tokens to a shared pot across a group of 2 to 10 players, move the marginal per capita return, and see exactly why free-riding is dominant while full contribution is efficient.",
};

export default function PublicGoodsPage() {
  return <PublicGoodsExperience />;
}
