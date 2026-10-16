import { Car, Bike, Tractor, Bus, PersonStanding, Truck, Ship, Train } from "lucide-react";
import type { VehicleType, VehicleConfig } from "@/app/lib/types";

/**
 * Vehicle flag registry — colours for the VehicleChip flags on post cards
 * and post details.
 *
 * Light-theme visibility contract (design-system §colour-palette, WCAG AA —
 * modelled on the route-request flag `bg-warning text-warning-text
 * border-warning-border`, which stays readable in both themes): every entry
 * pairs a *saturated* light background (`-200`, never the near-white `-50`
 * wash that dissolved into the white card, nor the still-pale `-100` that
 * read as plain text on `bg-bg-card`) with a dark (`-900`) label plus a
 * deepened (`-400`) border, so the flag reads as a flag on white cards in
 * light theme. `-900` (not `-800`) is deliberate: the darker label maximises
 * contrast against BOTH the tinted badge wash and the surrounding app/card
 * surface in light theme. Dark variants (`-900/10` wash + `-300` label +
 * `-800` border) are unchanged in behaviour, only gaining the same border
 * for definition. Borders come from `borderClass` — the chip always renders
 * `border` + this class, never a bare wash.
 */
export const VEHICLE_REGISTRY: Record<VehicleType, VehicleConfig> = {
  taxi: {
    label: "Taxi",
    icon: Car,
    color: "#F59E0B",
    bgClass: "bg-yellow-200 dark:bg-yellow-900/10",
    textClass: "text-yellow-900 dark:text-yellow-300",
    borderClass: "border-yellow-400 dark:border-yellow-800",
  },
  bike: {
    label: "Bike",
    icon: Bike,
    color: "#EA580C",
    bgClass: "bg-orange-200 dark:bg-orange-900/10",
    textClass: "text-orange-900 dark:text-orange-300",
    borderClass: "border-orange-400 dark:border-orange-800",
  },
  keke: {
    label: "Keke",
    icon: Tractor,
    color: "#16A34A",
    bgClass: "bg-green-200 dark:bg-green-900/10",
    textClass: "text-green-900 dark:text-green-300",
    borderClass: "border-green-400 dark:border-green-800",
  },
  bus: {
    label: "Bus",
    icon: Bus,
    color: "#2563EB",
    bgClass: "bg-blue-200 dark:bg-blue-900/10",
    textClass: "text-blue-900 dark:text-blue-300",
    borderClass: "border-blue-400 dark:border-blue-800",
  },
  trekking: {
    label: "Trekking",
    icon: PersonStanding,
    color: "#374151",
    bgClass: "bg-gray-300 dark:bg-gray-900/10",
    textClass: "text-gray-900 dark:text-gray-300",
    borderClass: "border-gray-400 dark:border-gray-700",
  },
  car: {
    label: "Car",
    icon: Car,
    color: "#4338CA",
    bgClass: "bg-indigo-200 dark:bg-indigo-900/10",
    textClass: "text-indigo-900 dark:text-indigo-300",
    borderClass: "border-indigo-400 dark:border-indigo-800",
  },
  bolt: {
    label: "Bolt Ride",
    icon: Truck,
    color: "#65A30D",
    bgClass: "bg-lime-200 dark:bg-lime-900/10",
    textClass: "text-lime-900 dark:text-lime-300",
    borderClass: "border-lime-400 dark:border-lime-800",
  },
  boat: {
    label: "Boat",
    icon: Ship,
    color: "#0E7490",
    bgClass: "bg-cyan-200 dark:bg-cyan-900/10",
    textClass: "text-cyan-900 dark:text-cyan-300",
    borderClass: "border-cyan-400 dark:border-cyan-800",
  },
  train: {
    label: "Train",
    icon: Train,
    color: "#6D28D9",
    bgClass: "bg-violet-200 dark:bg-violet-900/10",
    textClass: "text-violet-900 dark:text-violet-300",
    borderClass: "border-violet-400 dark:border-violet-800",
  },
};
