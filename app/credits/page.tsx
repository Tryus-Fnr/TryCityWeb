import type { Metadata } from "next";
import {
  Crown,
  Palette,
  Code2,
  HardHat,
  Globe,
  Tv2,
  Youtube,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Credits – TryCity",
  description: "Das Team hinter dem TryCity Minecraft-Netzwerk.",
};

/* ─── Types ─────────────────────────────────────────────────── */

type SocialLink = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

type CreditMember = {
  name: string;
  roles: string[];
  links?: SocialLink[];
  accent: string;
  ring: string;
  iconBg: string;
  icon: React.ReactNode;
};

type BuilderMember = {
  name: string;
  isHead?: boolean;
};

/* ─── Data ───────────────────────────────────────────────────── */

const iconSize = "h-4 w-4";

const mainCredits: CreditMember[] = [
  {
    name: "Tryus",
    roles: ["Owner", "Content Creator", "Streamer"],
    links: [
      {
        label: "Twitch",
        href: "https://twitch.tv/tryus",
        icon: <Tv2 className={iconSize} />,
      },
      {
        label: "YouTube · MehrTryus",
        href: "https://www.youtube.com/@MehrTryus",
        icon: <Youtube className={iconSize} />,
      },
      {
        label: "YouTube · Tryusfnr",
        href: "https://youtube.com/@Tryusfnr",
        icon: <Youtube className={iconSize} />,
      },
      {
        label: "Discord",
        href: "https://discord.gg/zJaQ8tfyzh",
        icon: <MessageSquare className={iconSize} />,
      },
    ],
    accent: "text-violet-400",
    ring: "ring-violet-500/20",
    iconBg: "bg-violet-500/10 text-violet-400",
    icon: <Crown className="h-5 w-5" />,
  },
  {
    name: "Matija",
    roles: ["Texture Designer", "3D Model Designer"],
    links: [
      {
        label: "matijasworkshop.framer.website",
        href: "https://matijasworkshop.framer.website/",
        icon: <Globe className={iconSize} />,
      },
      {
        label: "Discord",
        href: "https://discord.gg/wmfT9Ca98G",
        icon: <MessageSquare className={iconSize} />,
      },
    ],
    accent: "text-sky-400",
    ring: "ring-sky-500/20",
    iconBg: "bg-sky-500/10 text-sky-400",
    icon: <Palette className="h-5 w-5" />,
  },
  {
    name: "Leon_lp9",
    roles: ["Developer", "Server Management"],
    accent: "text-amber-400",
    ring: "ring-amber-500/20",
    iconBg: "bg-amber-500/10 text-amber-400",
    icon: <Code2 className="h-5 w-5" />,
  },
];

const builders: BuilderMember[] = [
  { name: "Tipsoi", isHead: true },
  { name: "LeonUHD" },
  { name: "Runn1n9" },
];

/* ─── Components ─────────────────────────────────────────────── */

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-white/5 px-2.5 py-0.5 text-xs font-medium text-neutral-400 ring-1 ring-white/8">
      {label}
    </span>
  );
}

function MemberCard({ member }: { member: CreditMember }) {
  return (
    <div
      className={`rounded-2xl bg-white/3 px-6 py-5 ring-1 ${member.ring} flex flex-col gap-3`}
    >
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${member.iconBg}`}>{member.icon}</div>
        <span className={`text-xl font-bold tracking-tight ${member.accent}`}>
          {member.name}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {member.roles.map((r) => (
          <RoleBadge key={r} label={r} />
        ))}
      </div>

      {member.links && member.links.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
          {member.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 text-xs ${member.accent} opacity-60 hover:opacity-100 transition-opacity`}
            >
              {l.icon}
              {l.label}
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function BuilderCard({ builder }: { builder: BuilderMember }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ${
        builder.isHead
          ? "bg-emerald-500/8 ring-emerald-500/25"
          : "bg-white/2 ring-white/8"
      }`}
    >
      <div
        className={`rounded-md p-1.5 ${
          builder.isHead
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-white/5 text-neutral-400"
        }`}
      >
        <HardHat className="h-4 w-4" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          className={`text-sm font-semibold ${
            builder.isHead ? "text-emerald-400" : "text-neutral-200"
          }`}
        >
          {builder.name}
        </span>
        {builder.isHead && (
          <span className="text-[10px] font-medium uppercase tracking-widest text-emerald-500/70">
            Head Builder
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-3xl py-12 px-4">
      {/* Header */}
      <div className="mb-12 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Das Team
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Credits</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Die Menschen hinter TryCity
        </p>
      </div>

      {/* Main team */}
      <div className="flex flex-col gap-4">
        {mainCredits.map((member) => (
          <MemberCard key={member.name} member={member} />
        ))}
      </div>

      {/* Builder Team */}
      <div className="mt-6 rounded-2xl bg-white/3 px-6 py-5 ring-1 ring-emerald-500/20">
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-lg p-2 bg-emerald-500/10 text-emerald-400">
            <HardHat className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-emerald-400">
              Builder Team
            </span>
            <p className="text-xs text-neutral-500 mt-0.5">
              Verantwortlich für die Welt & alle Gebäude
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {builders.map((b) => (
            <BuilderCard key={b.name} builder={b} />
          ))}
        </div>
      </div>

      {/* Beta Tester */}
      <div className="mt-6 rounded-2xl bg-white/2 px-6 py-5 ring-1 ring-white/8 flex items-start gap-4">
        <div className="rounded-lg p-2 bg-neutral-500/10 text-neutral-400 mt-0.5">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <span className="text-base font-semibold text-neutral-200">
            Beta Tester
          </span>
          <p className="mt-1 text-sm text-neutral-500 leading-relaxed">
            Ein grosses Dankeschön an alle, die TryCity in der Beta-Phase
            getestet und mit ihrem Feedback geholfen haben, das Netzwerk besser
            zu machen.
          </p>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-neutral-600">
        TryCity Netzwerk &mdash; Danke an alle, die dieses Projekt möglich
        machen.
      </p>
    </div>
  );
}


