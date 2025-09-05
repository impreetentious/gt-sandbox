import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuctionPlayExperience } from "@/components/auction/auction-play";
import { auctionFormatContent, auctionSlugToFormat } from "@/content/auctions";

export function generateStaticParams(): Array<{ format: string }> {
  return Object.keys(auctionSlugToFormat).map((format) => ({ format }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ format: string }>;
}): Promise<Metadata> {
  const { format } = await params;
  const resolved = auctionSlugToFormat[format];
  if (!resolved) {
    return { title: "Auction not found" };
  }
  const content = auctionFormatContent[resolved];
  return { title: content.title, description: content.framing };
}

export default async function AuctionPage({
  params,
}: {
  params: Promise<{ format: string }>;
}) {
  const { format } = await params;
  const resolved = auctionSlugToFormat[format];
  if (!resolved) {
    notFound();
  }
  return <AuctionPlayExperience format={resolved} />;
}
