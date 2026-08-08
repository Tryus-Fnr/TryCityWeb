import ItemBrowser from "@/components/ItemBrowser";

export const metadata = { title: "Item-Werte – TryCity" };

export default function ItemsPage() {
  return (
    // Kopf im selben Aufbau wie im Blog, damit die Unterseiten sich gleich
    // anfühlen: Überschrift, darunter ein erklärender Absatz in Lesebreite.
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Item-Werte</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Die Verkaufspreise der dynamischen Wirtschaft. Sie werden alle 12 Stunden neu
          berechnet – was viel verkauft wird, verliert an Wert, seltenes steigt. Ein Klick
          auf ein Item zeigt den vollständigen Preisverlauf.
        </p>
      </header>

      <ItemBrowser />
    </div>
  );
}
