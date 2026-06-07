"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type CampaignData = {
  id: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_href: string | null;
  format: string;
};

/** Pop-up de campaña: aparece al entrar, se descarta por sesión. */
export function CampaignPopup({ campaign }: { campaign: CampaignData }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `campaign_seen_${campaign.id}`;
    if (!sessionStorage.getItem(key)) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [campaign.id]);

  const dismiss = () => {
    sessionStorage.setItem(`campaign_seen_${campaign.id}`, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={campaign.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md border border-accent/40 bg-deep p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <p className="section-mark !text-accent">§ Campaña</p>
          <button
            onClick={dismiss}
            aria-label="Cerrar"
            className="text-graphite hover:text-ink"
          >
            ✕
          </button>
        </div>
        <h2 className="mb-2 text-xl">{campaign.title}</h2>
        <p className="mb-5 text-sm text-graphite">{campaign.body}</p>
        {campaign.cta_label && campaign.cta_href ? (
          <Link
            href={campaign.cta_href}
            onClick={dismiss}
            className="block bg-accent px-4 py-2.5 text-center text-sm font-medium text-deep hover:bg-accent-hover"
          >
            {campaign.cta_label} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Banner sticky de campaña (portal y app). */
export function CampaignBanner({ campaign }: { campaign: CampaignData }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-accent/40 bg-deep px-6 py-2.5">
      <p className="text-sm">
        <span className="mr-2 text-accent">■</span>
        <span className="font-medium">{campaign.title}</span>
        <span className="ml-2 text-graphite">{campaign.body}</span>
        {campaign.cta_label && campaign.cta_href ? (
          <Link href={campaign.cta_href} className="ml-3 text-accent hover:text-accent-hover">
            {campaign.cta_label} →
          </Link>
        ) : null}
      </p>
      <button
        onClick={() => setVisible(false)}
        aria-label="Cerrar banner"
        className="text-graphite hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
