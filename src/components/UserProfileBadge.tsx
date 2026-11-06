import { Check, ChevronDown, Link2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { getAvatarInitials, normalizeDisplayName, type PlayerProfile } from "@/lib/playerProfile";
import { AuthGateway } from "@/components/AuthGateway";
import type { AccountProfile } from "@/lib/authService";
import type { GarageSaveData } from "@/lib/garageSave";

type UserProfileBadgeProps = {
  profile: PlayerProfile;
  isGuest: boolean;
  guestSaveData: GarageSaveData;
  onSave: (profile: PlayerProfile) => void;
  onAuthenticated: (account: AccountProfile) => void | Promise<void>;
};

export function UserProfileBadge({ profile, isGuest, guestSaveData, onSave, onAuthenticated }: UserProfileBadgeProps) {
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [draft, setDraft] = useState(profile.displayName);

  useEffect(() => setDraft(profile.displayName), [profile.displayName]);

  const save = () => {
    onSave({ ...profile, displayName: normalizeDisplayName(draft) });
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Player profile: ${profile.displayName}, level ${profile.level}. Edit profile`}
        className="atelier-pill flex h-10 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:border-white/25 hover:bg-white/5 sm:px-2.5"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#F5C518]/45 bg-gradient-to-br from-[#DC1A22]/80 to-[#4b1d50] font-mono-tech text-[10px] font-bold text-white shadow-[0_0_12px_rgba(220,26,34,0.16)]">
          {getAvatarInitials(profile.displayName)}
        </span>
        <span className="block min-w-0">
          <span className="block max-w-20 truncate font-display text-[10px] font-semibold text-white sm:max-w-24 sm:text-[11px] md:max-w-32">{profile.displayName}</span>
          <span className="hidden font-mono-tech text-[8px] uppercase tracking-wider text-[#F5C518] sm:block">{profile.rank} · LVL {profile.level}</span>
        </span>
        <ChevronDown aria-hidden="true" className="h-3 w-3 text-zinc-500" />
      </button>

      {open && (
        <div role="dialog" aria-label="Edit player profile" className="atelier-panel absolute right-0 top-full z-[80] mt-2 w-[min(19rem,calc(100vw_-_1rem))] rounded-2xl border border-white/12 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.7)]">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-[#F5C518]/45 bg-gradient-to-br from-[#DC1A22]/80 to-[#4b1d50] font-mono-tech text-sm font-bold text-white">
              {getAvatarInitials(profile.displayName)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-semibold text-white">{profile.displayName}</div>
              <div className="mt-0.5 font-mono-tech text-[9px] uppercase tracking-wider text-[#F5C518]">{profile.rank} · LEVEL {profile.level}</div>
            </div>
          </div>
          <label htmlFor="racer-display-name" className="mt-3 block font-mono-tech text-[9px] uppercase tracking-[0.16em] text-zinc-400">Display name</label>
          <input
            id="racer-display-name"
            value={draft}
            maxLength={20}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") setOpen(false);
            }}
            className="mt-1.5 w-full rounded-lg border border-white/12 bg-black/35 px-3 py-2 font-display text-sm text-white outline-none focus:border-[#F5C518]/60"
            placeholder="Guest Racer"
          />
          <div className="mt-2 text-[10px] leading-relaxed text-zinc-500">{isGuest ? "Guest session · saved in this tab until you link an account." : "Signed in · garage progress syncs to your cloud account."}</div>
          {isGuest && (
            <button type="button" onClick={() => setLinkOpen(true)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#F5C518]/35 bg-gradient-to-r from-[#F5C518]/15 to-[#DC1A22]/15 px-3 py-2.5 font-mono-tech text-[9px] font-black uppercase tracking-[.11em] text-amber-100 shadow-[0_0_20px_rgba(245,197,24,.08)] transition-colors hover:border-[#F5C518]/60 hover:from-[#F5C518]/20 hover:to-[#DC1A22]/25">
              <Link2 className="h-3.5 w-3.5" /> LINK ACCOUNT / SAVE PROGRESS
            </button>
          )}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/8 pt-3">
            <span className="inline-flex items-center gap-1.5 font-mono-tech text-[8px] uppercase tracking-wider text-zinc-500">{isGuest ? <><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Guest session</> : <><ShieldCheck className="h-3 w-3 text-emerald-300" /> Cloud account</>}</span>
            <button type="button" onClick={save} className="flex items-center gap-1.5 rounded-lg bg-[#DC1A22] px-3 py-2 font-mono-tech text-[9px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#b9151c]">
              <Check className="h-3.5 w-3.5" /> Save Name
            </button>
          </div>
        </div>
      )}
      {linkOpen && isGuest && (
        <AuthGateway
          open
          mode="link"
          guestSaveData={guestSaveData}
          onClose={() => setLinkOpen(false)}
          onAuthenticated={async (account) => {
            await onAuthenticated(account);
            setLinkOpen(false);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
