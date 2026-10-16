import { Car, Bike, Tractor, Bus, PersonStanding, Truck, Ship, Train } from "lucide-react";
import type { VehicleType, VehicleConfig } from "@/app/lib/types";

/**
 * Vehicle flag registry — colours for the VehicleChip flags on post cards
 * and post details.
 *
 * Light-theme visibility contract (design-system §colour-palette, WCAG AA):
 * every entry pairs a *saturated* light background (`-100`, never the
 * near-white `-50` wash that dissolved into the white card) with a dark
 * (`-900`) label plus a matching border, so the flag reads as a flag on
 * `bg-bg-card` in light theme. `-900` (not `-800`) is deliberate: the darker
 * label maximises contrast against BOTH the tinted badge wash and the
 * surrounding app/card surface in light theme. Dark variants (`-900/10`
 * wash + `-300` label + `-800` border) are unchanged in behaviour, only
 * gaining the same border for definition. Borders come from `borderClass` —
 * the chip always renders `border` + this class, never a bare wash.
 */
export const VEHICLE_REGISTRY: Record<VehicleType, VehicleConfig> = {
  taxi: {
    label: "Taxi",
    icon: Car,
    color: "#F59E0B",
    bgClass: "bg-yellow-100 dark:bg-yellow-900/10",
    textClass: "text-yellow-900 dark:text-yellow-300",
    borderClass: "border-yellow-300 dark:border-yellow-800",
  },
  bike: {
    label: "Bike",
    icon: Bike,
    color: "#EA580C",
    bgClass: "bg-orange-100 dark:bg-orange-900/10",
    textClass: "text-orange-900 dark:text-orange-300",
    borderClass: "border-orange-300 dark:border-orange-800",
  },
  keke: {
    label: "Keke",
    icon: Tractor,
    color: "#16A34A",
    bgClass: "bg-green-100 dark:bg-green-900/10",
    textClass: "text-green-900 dark:text-green-300",
    borderClass: "border-green-300 dark:border-green-800",
  },
  bus: {
    label: "Bus",
    icon: Bus,
    color: "#2563EB",
    bgClass: "bg-blue-100 dark:bg-blue-900/10",
    textClass: "text-blue-900 dark:text-blue-300",
    borderClass: "border-blue-300 dark:border-blue-800",
  },
  trekking: {
    label: "Trekking",
    icon: PersonStanding,
    color: "#374151",
    bgClass: "bg-gray-200 dark:bg-gray-900/10",
    textClass: "text-gray-900 dark:text-gray-300",
    borderClass: "border-gray-300 dark:border-gray-700",
  },
  car: {
    label: "Car",
    icon: Car,
    color: "#4338CA",
    bgClass: "bg-indigo-100 dark:bg-indigo-900/10",
    textClass: "text-indigo-900 dark:text-indigo-300",
    borderClass: "border-indigo-300 dark:border-indigo-800",
  },
  bolt: {
    label: "Bolt Ride",
    icon: Truck,
    color: "#65A30D",
    bgClass: "bg-lime-100 dark:bg-lime-900/10",
    textClass: "text-lime-900 dark:text-lime-300",
    borderClass: "border-lime-300 dark:border-lime-800",
  },
  boat: {
    label: "Boat",
    icon: Ship,
    color: "#0E7490",
    bgClass: "bg-cyan-100 dark:bg-cyan-900/10",
    textClass: "text-cyan-900 dark:text-cyan-300",
    borderClass: "border-cyan-300 dark:border-cyan-800",
  },
  train: {
    label: "Train",
    icon: Train,
    color: "#6D28D9",
    bgClass: "bg-violet-100 dark:bg-violet-900/10",
    textClass: "text-violet-900 dark:text-violet-300",
    borderClass: "border-violet-300 dark:border-violet-800",
  },
};
