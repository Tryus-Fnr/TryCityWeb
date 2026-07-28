import { Newspaper, Radio } from "lucide-react";
import AdminNav from "@/components/admin/AdminNav";

const NAV_ITEMS = [
  { href: "/admin/news", label: "Neuigkeiten", icon: <Newspaper className="h-4 w-4" /> },
  { href: "/admin/bossbar", label: "Bossbar", icon: <Radio className="h-4 w-4" /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <AdminNav items={NAV_ITEMS} />
      {children}
    </div>
  );
}

