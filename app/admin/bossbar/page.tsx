import { requireAdmin } from "@/lib/auth";
import { loadBossBarMessages, loadBossBarConfig } from "@/lib/bossbar";
import BossBarAdmin from "@/components/bossbar/BossBarAdmin";

export const dynamic = "force-dynamic";

export default async function AdminBossBarPage() {
  await requireAdmin();
  const [messages, config] = await Promise.all([
    loadBossBarMessages(),
    loadBossBarConfig(),
  ]);

  return <BossBarAdmin initialMessages={messages} initialConfig={config} />;
}

