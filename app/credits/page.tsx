import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Credits – TryCity",
  description: "Das Team hinter dem TryCity Minecraft-Netzwerk.",
};

type CreditMember = {
  name: string;
  role: string[];
  link?: string;
  linkLabel?: string;
  emoji: string;
  accent: string;
  accentBg: string;
};

const credits: CreditMember[] = [
  {
    name: "Tryus",
    role: ["Owner", "Main Content Creator", "Streamer"],
    link: "https://twitch.tv/tryus",
    linkLabel: "twitch.tv/tryus",
    emoji: "👑",
    accent: "text-violet-400",
    accentBg: "bg-violet-400/10 ring-violet-500/20",
  },
  {
    name: "Matija",
    role: ["Texture Designer", "3D Model Designer"],
    link: "https://www.premierstudios.net",
    linkLabel: "premierstudios.net",
    emoji: "🎨",
    accent: "text-sky-400",
    accentBg: "bg-sky-400/10 ring-sky-500/20",
  },
  {
    name: "Tipsoi",
    role: ["Builder"],
    emoji: "🏗️",
    accent: "text-emerald-400",
    accentBg: "bg-emerald-400/10 ring-emerald-500/20",
  },
  {
    name: "Leon_lp9",
    role: ["Developer", "Server Management"],
    emoji: "⚙️",
    accent: "text-amber-400",
    accentBg: "bg-amber-400/10 ring-amber-500/20",
  },
];

export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-3xl py-12 px-4">
      <div className="mb-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Das Team
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Credits</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Die Menschen hinter TryCity
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {credits.map((member) => (
          <div
            key={member.name}
            className={`flex items-start gap-5 rounded-2xl ring-1 px-6 py-5 ${member.accentBg}`}
          >
            {/* Emoji */}
            <div className="text-4xl select-none mt-0.5">{member.emoji}</div>

            {/* Info */}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <span className={`text-xl font-black ${member.accent}`}>
                {member.name}
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {member.role.map((r) => (
                  <span
                    key={r}
                    className="rounded-md bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-neutral-300 ring-1 ring-white/10"
                  >
                    {r}
                  </span>
                ))}
              </div>
              {member.link && (
                <a
                  href={member.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-2 text-xs ${member.accent} opacity-70 hover:opacity-100 transition-opacity`}
                >
                  🔗 {member.linkLabel ?? member.link}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-neutral-600">
        Danke an alle, die TryCity möglich machen. 💙
      </p>
    </div>
  );
}


