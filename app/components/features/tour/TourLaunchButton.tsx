"use client";

import { Compass } from "lucide-react";
import { AppButton, type AppButtonProps } from "@/app/components/ui";
import { TOUR_START_EVENT } from "@/app/lib/config/platformTour";
import { useTranslation } from "@/app/providers/I18nProvider";

interface TourLaunchButtonProps {
  label?: string;
  variant?: AppButtonProps["variant"];
  size?: AppButtonProps["size"];
  className?: string;
}

/**
 * Guest-safe tour entry point. Dispatches the same CustomEvent the profile
 * quick link uses, so the globally-mounted guide handles it on any page
 * (public, auth, or dashboard) without provider plumbing.
 */
export default function TourLaunchButton({
  label,
  variant = "secondary",
  size = "sm",
  className,
}: TourLaunchButtonProps) {
  const { t } = useTranslation();
  let resolved = label ?? "Take the platform tour";
  if (!label) {
    try {
      const translated = t("tour.takeTour");
      if (translated !== "tour.takeTour") resolved = translated;
    } catch {
      // Dictionary unavailable — keep the English fallback.
    }
  }

  return (
    <AppButton
      type="button"
      variant={variant}
      size={size}
      icon={<Compass size={14} aria-hidden />}
      className={className}
      onClick={() => {
        try {
          window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
        } catch {
          // No window (SSR/tests) — the button is inert, never throws.
        }
      }}
    >
      {resolved}
    </AppButton>
  );
}
