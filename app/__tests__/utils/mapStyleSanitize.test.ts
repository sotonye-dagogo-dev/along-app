/**
 * @jest-environment node
 *
 * Sprint 77 — mapStyleSanitize: coalesce-wraps data-driven numeric style
 * expressions with config fallbacks (maplibre-gl-js#7856 null-type warning
 * class), leaves static values and non-numeric props untouched, and is
 * idempotent + non-mutating.
 */
import {
  expressionReadsFeatureData,
  sanitizeMapStyleNumericExpressions,
} from "@/app/lib/utils/mapStyleSanitize";
import { MAP_STACK_CONFIG } from "@/app/lib/config/mapStack";

const FB = MAP_STACK_CONFIG.numericExpressionFallbacks;

function layer(props: Record<string, unknown>): Record<string, unknown> {
  return { id: "l1", type: "symbol", layout: props };
}

describe("Sprint 77: expressionReadsFeatureData", () => {
  it("detects get / has / feature-state / id ops anywhere in the tree", () => {
    expect(expressionReadsFeatureData(["get", "name-f"])).toBe(true);
    expect(expressionReadsFeatureData(["has", "siz"])).toBe(true);
    expect(expressionReadsFeatureData(["feature-state", "hover"])).toBe(true);
    expect(expressionReadsFeatureData(["id"])).toBe(true);
    expect(
      expressionReadsFeatureData(["interpolate", ["linear"], ["get", "siz"], 12, 1, 18, 4])
    ).toBe(true);
    expect(
      expressionReadsFeatureData([
        "case",
        ["boolean", ["feature-state", "hover"], false],
        10,
        8,
      ])
    ).toBe(true);
  });

  it("returns false for zoom-only expressions, literals and plain objects", () => {
    expect(expressionReadsFeatureData(["interpolate", ["linear"], ["zoom"], 5, 1, 18, 4])).toBe(
      false
    );
    expect(expressionReadsFeatureData(12)).toBe(false);
    expect(expressionReadsFeatureData("12")).toBe(false);
    expect(expressionReadsFeatureData(null)).toBe(false);
    expect(expressionReadsFeatureData({})).toBe(false);
  });
});

describe("Sprint 77: sanitizeMapStyleNumericExpressions", () => {
  it("coalesce-wraps data-driven numeric props in layout AND paint with config fallbacks", () => {
    const style = {
      version: 8,
      layers: [
        layer({
          "text-size": ["interpolate", ["linear"], ["get", "siz"], 12],
          "icon-size": ["get", "sc"],
        }),
        {
          id: "roads",
          type: "line",
          paint: {
            "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 18, 4],
            "circle-radius": ["+", 2, ["get", "r"]],
            "circle-stroke-width": ["coalesce", ["get", "sw"], 2],
            "line-color": "#fff",
          },
        },
      ],
    };
    const out = sanitizeMapStyleNumericExpressions(style) as typeof style;
    const [poi, road] = out.layers as {
      layout?: Record<string, unknown>;
      paint?: Record<string, unknown>;
    }[];

    expect(poi.layout?.["text-size"]).toEqual([
      "coalesce",
      ["interpolate", ["linear"], ["get", "siz"], 12],
      FB["text-size"],
    ]);
    expect(poi.layout?.["icon-size"]).toEqual(["coalesce", ["get", "sc"], FB["icon-size"]]);

    // Zoom-only expressions don't read feature data → untouched.
    expect(road.paint?.["line-width"]).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      5,
      1,
      18,
      4,
    ]);
    expect(road.paint?.["circle-radius"]).toEqual(["coalesce", ["+", 2, ["get", "r"]], FB["circle-radius"]]);
    // Already coalesced → left alone (idempotency at the value level).
    expect(road.paint?.["circle-stroke-width"]).toEqual(["coalesce", ["get", "sw"], 2]);
    // Non-numeric / static values untouched.
    expect(road.paint?.["line-color"]).toBe("#fff");
  });

  it("is idempotent — a second pass adds no extra coalesce layer", () => {
    const style = {
      version: 8,
      layers: [layer({ "text-size": ["get", "siz"] })],
    };
    const once = sanitizeMapStyleNumericExpressions(style);
    const twice = sanitizeMapStyleNumericExpressions(once);
    const size = (twice as typeof style).layers[0].layout as Record<string, unknown>;
    expect(size["text-size"]).toEqual(["coalesce", ["get", "siz"], FB["text-size"]]);
  });

  it("never mutates the input document", () => {
    const style = {
      version: 8,
      layers: [layer({ "text-size": ["get", "siz"] })],
    };
    const snapshot = JSON.stringify(style);
    sanitizeMapStyleNumericExpressions(style);
    expect(JSON.stringify(style)).toBe(snapshot);
  });

  it("passes through invalid shapes unchanged (malformed upstream can never crash the proxy)", () => {
    expect(sanitizeMapStyleNumericExpressions(null)).toBeNull();
    expect(sanitizeMapStyleNumericExpressions(undefined)).toBeUndefined();
    expect(sanitizeMapStyleNumericExpressions(42)).toBe(42);
    expect(sanitizeMapStyleNumericExpressions([1, 2])).toEqual([1, 2]);
    const noLayers = { version: 8 };
    expect(sanitizeMapStyleNumericExpressions(noLayers)).toEqual(noLayers);
    const badLayers = { version: 8, layers: "oops" };
    expect(sanitizeMapStyleNumericExpressions(badLayers)).toEqual(badLayers);
  });

  it("skips null/NaN fallbacks from a corrupted config instead of injecting garbage", () => {
    const out = sanitizeMapStyleNumericExpressions(
      { version: 8, layers: [layer({ "text-size": ["get", "siz"] })] },
      { "text-size": Number.NaN, "icon-size": 1 }
    ) as { layers: { layout: Record<string, unknown> }[] };
    // NaN fallback → expression untouched (guard rejects non-finite numbers).
    expect(out.layers[0].layout["text-size"]).toEqual(["get", "siz"]);
  });
});
