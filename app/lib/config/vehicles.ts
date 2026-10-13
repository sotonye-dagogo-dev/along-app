import { Car, Bike, Tractor, Bus, PersonStanding, Truck, Ship, Train } from "lucide-react";
import type { VehicleType, VehicleConfig } from "@/app/lib/types";

export const VEHICLE_REGISTRY: Record<VehicleType, VehicleConfig> = {
  taxi: {
    label: "Taxi",
    icon: Car,
    color: "#F59E0B",
    bgClass: "bg-yellow-50 dark:bg-yellow-900/10",
    textClass: "text-yellow-800 dark:text-yellow-300 ",
  },
  bike: {
    label: "Bike",
    icon: Bike,
    color: "#EA580C",
    bgClass: "bg-orange-50 dark:bg-orange-900/10",
    textClass: "text-orange-800 dark:text-orange-300",
  },
  keke: {
    label: "Keke",
    icon: Tractor,
    color: "#16A34A",
    bgClass: "bg-green-50 dark:bg-green-900/10",
    textClass: "text-green-800 dark:text-green-300",
  },
  bus: {
    label: "Bus",
    icon: Bus,
    color: "#2563EB",
    bgClass: "bg-blue-50 dark:bg-blue-900/10",
    textClass: "text-blue-800 dark:text-blue-300",
  },
  trekking: {
    label: "Trekking",
    icon: PersonStanding,
    color: "#374151",
    bgClass: "bg-gray-50 dark:bg-gray-900/10",
    textClass: "text-gray-700 dark:text-gray-300",
  },
  car: {
    label: "Car",
    icon: Car,
    color: "#4338CA",
    bgClass: "bg-indigo-50 dark:bg-indigo-900/10",
    textClass: "text-indigo-800 dark:text-indigo-300",
  },
  bolt: {
    label: "Bolt Ride",
    icon: Truck,
    color: "#65A30D",
    bgClass: "bg-lime-50 dark:bg-lime-900/10",
    textClass: "text-lime-800 dark:text-lime-300",
  },
  boat: {
    label: "Boat",
    icon: Ship,
    color: "#0E7490",
    bgClass: "bg-cyan-50 dark:bg-cyan-900/10",
    textClass: "text-cyan-800 dark:text-cyan-300",
  },
  train: {
    label: "Train",
    icon: Train,
    color: "#6D28D9",
    bgClass: "bg-violet-50 dark:bg-violet-900/10",
    textClass: "text-violet-800 dark:text-violet-300",
  },
};
