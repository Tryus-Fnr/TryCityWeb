import ItemBrowser from "@/components/ItemBrowser";

export const metadata = { title: "Item-Werte – TryCity" };

export default function ItemsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Item-Werte</h1>
        <p className="mt-1 text-neutral-400">
          Aktuelle Verkaufspreise der dynamischen Wirtschaft – Item anklicken für den
          Preisverlauf.
        </p>
      </div>
      <ItemBrowser />
    </div>
  );
}
