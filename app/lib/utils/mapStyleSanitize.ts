/**
 * MapLibre style sanitizer (Sprint 77) — pure, zero side effects.
 *
 * OpenFreeMap styles use data-driven expressions (`["get", …]` inside e.g.
 * `layout["text-size"]`) that evaluate to `null` on features missing the
 * property. MapLibre then logs "Expected value to be of type number, but
 * found null instead." (maplibre-gl-js#7856 — cosmetic; rendering continues).
 *
 * The sanitizer walks `layers[].layout` / `layers[].paint` and coalesce-wraps
 * ONLY numeric properties whose expression tree reads feature data, with the
 * config fallback as the last child:
 *   ["interpolate", …, ["get", "siz"]]  →  ["coalesce", ["interpolate", …], 12]
 * Static numbers, zoom-only expressions, and already-coalesced values are
 * untouched, so the transform is idempotent and cannot change how valid
 * features render. The compiled coalesce form is lazy (children evaluate
 * inside try/catch), so the inner null never reaches the numeric type check.
 */

import { MAP_STACK_CONFIG } from "@/app/lib/config/mapStack";

/** Expression ops that read per-feature data (can yield null on sparse props). */
const FEATURE_DATA_OPS = new Set(["get", "has", "feature-state", "id"]);

type Expression = unknown[];

function isExpressionArray(value: unknown): value is Expression {
  return Array.isArray(value) && value.length > 0 && typeof value[0] === "string";
}

/** Recursive scan: does any node in this expression tree read feature data? */
export function expressionReadsFeatureData(node: unknown): boolean {
  if (!Array.isArray(node)) return false;
  if (node.length > 0 && typeof node[0] === "string" && FEATURE_DATA_OPS.has(node[0])) {
    return true;
  }
  for (const child of node) {
    if (expressionReadsFeatureData(child)) return true;
  }
  return false;
}

/** True when the value is already a top-level coalesce (idempotency guard). */
function isCoalesceWrapped(value: Expression): boolean {
  return value[0] === "coalesce";
}

/**
 * Sanitize one style document. Accepts `unknown` (upstream JSON) and returns
 * a NEW document; input is never mutated. Invalid shapes pass through
 * unchanged so a malformed upstream can never crash the proxy.
 */
export function sanitizeMapStyleNumericExpressions(
  style: unknown,
  fallbacks: Record<string, number> = MAP_STACK_CONFIG.numericExpressionFallbacks
): unknown {
  if (style === null || typeof style !== "object" || Array.isArray(style)) return style;

  let clone: Record<string, unknown>;
  try {
    clone = structuredClone(style) as Record<string, unknown>;
  } catch {
    try {
      clone = JSON.parse(JSON.stringify(style)) as Record<string, unknown>;
    } catch {
      return style;
    }
  }

  const layers = clone.layers;
  if (!Array.isArray(layers)) return clone;

  for (const layer of layers) {
    if (layer === null || typeof layer !== "object") continue;
    const record = layer as Record<string, unknown>;
    for (const section of ["layout", "paint"] as const) {
      const props = record[section];
      if (props === null || typeof props !== "object" || Array.isArray(props)) continue;
      const propRecord = props as Record<string, unknown>;
      for (const [prop, fallback] of Object.entries(fallbacks)) {
        const value = propRecord[prop];
        if (!isExpressionArray(value)) continue;
        if (isCoalesceWrapped(value)) continue;
        if (!expressionReadsFeatureData(value)) continue;
        if (typeof fallback !== "number" || !Number.isFinite(fallback)) continue;
        propRecord[prop] = ["coalesce", value, fallback];
      }
    }
  }

  return clone;
}
