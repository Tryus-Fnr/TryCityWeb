import type { Metadata } from "next";
import OrderBrowser from "@/components/OrderBrowser";

export const metadata: Metadata = { title: "Orders – TryCity" };

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="mt-1 text-neutral-400">
          Offene Kaufaufträge von Spielern – liefere Items und verdiene Coins.
        </p>
      </div>
      <OrderBrowser />
    </div>
  );
}


