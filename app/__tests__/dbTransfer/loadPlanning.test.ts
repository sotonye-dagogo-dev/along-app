/**
 * Load-planning tests — the part that decides in which order rows can be
 * inserted without violating a foreign key.
 *
 * The app has two real reference cycles (`Post.quotedPostId` → `Post.id`
 * and `User.invitedById` → `User.id`). Both must be detected and deferred;
 * a cycle through a NOT NULL column must fail loudly rather than produce a
 * load that cannot possibly succeed.
 */

import {
  buildLoadPlan,
  quoteIdent,
  quoteIdents,
  quoteLiteral,
  restorableTables,
  stronglyConnectedComponents,
  type Queryable,
} from "@/scripts/lib/dbTransfer/introspect";
import type { BackupTableSchema, BackupColumnMeta } from "@/scripts/lib/dbTransfer/types";

function column(name: string, overrides: Partial<BackupColumnMeta> = {}): BackupColumnMeta {
  return {
    name,
    dataType: "text",
    udtName: "text",
    isNullable: false,
    ordinalPosition: 1,
    oid: 25,
    hasSerialDefault: false,
    hasDefault: false,
    ...overrides,
  };
}

function table(
  name: string,
  options: {
    columns?: string[];
    primaryKey?: string[];
    foreignKeys?: BackupTableSchema["foreignKeys"];
  } = {},
): BackupTableSchema {
  return {
    name,
    columns: (options.columns ?? ["id"]).map((c) => column(c)),
    primaryKey: options.primaryKey ?? ["id"],
    foreignKeys: options.foreignKeys ?? [],
  };
}

describe("identifier quoting", () => {
  it("quotes identifiers and escapes embedded quotes", () => {
    expect(quoteIdent("User")).toBe('"User"');
    expect(quoteIdent('we"ird')).toBe('"we""ird"');
  });

  it("quotes a column list", () => {
    expect(quoteIdents(["a", "b"])).toBe('"a", "b"');
  });

  it("escapes string literals so table names cannot inject SQL", () => {
    expect(quoteLiteral("User")).toBe("'User'");
    expect(quoteLiteral("it's")).toBe("'it''s'");
    expect(quoteLiteral("'; DROP TABLE users; --")).toBe("'''; DROP TABLE users; --'");
  });
});

describe("stronglyConnectedComponents", () => {
  it("splits independent nodes", () => {
    const edges = new Map<string, string[]>();
    expect(stronglyConnectedComponents(["a", "b"], edges)).toEqual([["a"], ["b"]]);
  });

  it("groups a two-way reference into one component", () => {
    const edges = new Map<string, string[]>([
      ["a", ["b"]],
      ["b", ["a"]],
    ]);
    const components = stronglyConnectedComponents(["a", "b"], edges);
    expect(components).toEqual([["a", "b"]]);
  });

  it("emits components in reverse-dependency order (children finish first)", () => {
    // Tarjan emits a component only once all components it points at are
    // complete, so "child" (which depends on "parent") is emitted second.
    // `buildLoadPlan` then topologically re-sorts these into insert order.
    const edges = new Map<string, string[]>([["child", ["parent"]]]);
    expect(stronglyConnectedComponents(["child", "parent"], edges)).toEqual([
      ["parent"],
      ["child"],
    ]);
  });

  it("handles a self-loop", () => {
    const edges = new Map<string, string[]>([["self", ["self"]]]);
    expect(stronglyConnectedComponents(["self"], edges)).toEqual([["self"]]);
  });

  it("does not recurse — survives a long dependency chain", () => {
    const nodes = Array.from({ length: 5000 }, (_, i) => `n${i}`);
    const edges = new Map<string, string[]>();
    for (let i = 1; i < nodes.length; i += 1) edges.set(nodes[i], [nodes[i - 1]]);

    const components = stronglyConnectedComponents(nodes, edges);
    expect(components).toHaveLength(5000);
    expect(components.flat()).toHaveLength(5000);
  });

  it("is deterministic regardless of input order", () => {
    const edges = new Map<string, string[]>([
      ["a", ["b"]],
      ["b", ["c"]],
    ]);
    const first = stronglyConnectedComponents(["a", "b", "c"], edges);
    const second = stronglyConnectedComponents(["c", "b", "a"], edges);
    expect(first).toEqual(second);
  });
});

describe("buildLoadPlan", () => {
  it("puts parents before children", () => {
    const plan = buildLoadPlan([
      table("Comment", {
        foreignKeys: [{ column: "postId", refTable: "Post", refColumn: "id", isNullable: false }],
      }),
      table("Post", {
        foreignKeys: [{ column: "authorId", refTable: "User", refColumn: "id", isNullable: false }],
      }),
      table("User"),
    ]);

    expect(plan.loadOrder).toEqual(["User", "Post", "Comment"]);
    expect(plan.cyclicFks).toEqual([]);
  });

  it("resolves a diamond dependency without duplicating tables", () => {
    const plan = buildLoadPlan([
      table("A", {
        foreignKeys: [
          { column: "b", refTable: "B", refColumn: "id", isNullable: false },
          { column: "c", refTable: "C", refColumn: "id", isNullable: false },
        ],
      }),
      table("B", { foreignKeys: [{ column: "c", refTable: "C", refColumn: "id", isNullable: false }] }),
      table("C"),
    ]);

    expect(plan.loadOrder).toHaveLength(3);
    expect(plan.loadOrder.indexOf("C")).toBeLessThan(plan.loadOrder.indexOf("B"));
    expect(plan.loadOrder.indexOf("C")).toBeLessThan(plan.loadOrder.indexOf("A"));
    expect(plan.loadOrder.indexOf("B")).toBeLessThan(plan.loadOrder.indexOf("A"));
  });

  it("DEFERS a nullable self-relation (Post.quotedPostId)", () => {
    const plan = buildLoadPlan([
      table("Post", {
        columns: ["id", "quotedPostId"],
        foreignKeys: [{ column: "quotedPostId", refTable: "Post", refColumn: "id", isNullable: true }],
      }),
    ]);

    expect(plan.loadOrder).toEqual(["Post"]);
    expect(plan.cyclicFks).toEqual([{ table: "Post", columns: ["quotedPostId"] }]);
  });

  it("DEFERS a nullable self-relation (User.invitedById)", () => {
    const plan = buildLoadPlan([
      table("User", {
        columns: ["id", "invitedById"],
        foreignKeys: [{ column: "invitedById", refTable: "User", refColumn: "id", isNullable: true }],
      }),
    ]);

    expect(plan.cyclicFks).toEqual([{ table: "User", columns: ["invitedById"] }]);
  });

  it("BLOWS UP on a cycle through a NOT NULL column — there is no two-pass fix", () => {
    expect(() =>
      buildLoadPlan([
        table("Post", {
          columns: ["id", "quotedPostId"],
          foreignKeys: [{ column: "quotedPostId", refTable: "Post", refColumn: "id", isNullable: false }],
        }),
      ]),
    ).toThrow(/NOT NULL/);
  });

  it("defers every internal edge of a multi-table cycle", () => {
    const plan = buildLoadPlan([
      table("A", {
        columns: ["id", "bId"],
        foreignKeys: [
          { column: "bId", refTable: "B", refColumn: "id", isNullable: true },
          { column: "parentId", refTable: "A", refColumn: "id", isNullable: true },
        ],
      }),
      table("B", {
        columns: ["id", "aId"],
        foreignKeys: [{ column: "aId", refTable: "A", refColumn: "id", isNullable: true }],
      }),
    ]);

    const byTable = Object.fromEntries(plan.cyclicFks.map((c) => [c.table, c.columns]));
    expect(byTable.A).toEqual(["bId", "parentId"]);
    expect(byTable.B).toEqual(["aId"]);
  });

  it("does not defer an edge that leaves the cycle", () => {
    const plan = buildLoadPlan([
      table("A", {
        columns: ["id", "bId", "creatorId"],
        foreignKeys: [
          { column: "bId", refTable: "B", refColumn: "id", isNullable: true },
          { column: "creatorId", refTable: "User", refColumn: "id", isNullable: false },
        ],
      }),
      table("B", {
        columns: ["id", "aId"],
        foreignKeys: [{ column: "aId", refTable: "A", refColumn: "id", isNullable: true }],
      }),
      table("User"),
    ]);

    const a = plan.cyclicFks.find((c) => c.table === "A");
    expect(a?.columns).toEqual(["bId"]);
    expect(plan.loadOrder).toContain("User");
  });

  it("ignores foreign keys pointing outside the transferred schema", () => {
    const plan = buildLoadPlan([
      table("A", {
        columns: ["id", "externalId"],
        foreignKeys: [{ column: "externalId", refTable: "OtherDb", refColumn: "id", isNullable: true }],
      }),
    ]);
    expect(plan.loadOrder).toEqual(["A"]);
    expect(plan.cyclicFks).toEqual([]);
  });

  it("handles the app's real schema shape: 3 chained tables + one self-cycle", () => {
    const plan = buildLoadPlan([
      table("User", {
        columns: ["id", "invitedById"],
        foreignKeys: [{ column: "invitedById", refTable: "User", refColumn: "id", isNullable: true }],
      }),
      table("Post", {
        columns: ["id", "authorId", "quotedPostId"],
        foreignKeys: [
          { column: "authorId", refTable: "User", refColumn: "id", isNullable: false },
          { column: "quotedPostId", refTable: "Post", refColumn: "id", isNullable: true },
        ],
      }),
      table("Comment", {
        columns: ["id", "postId", "authorId"],
        foreignKeys: [
          { column: "postId", refTable: "Post", refColumn: "id", isNullable: false },
          { column: "authorId", refTable: "User", refColumn: "id", isNullable: false },
        ],
      }),
    ]);

    expect(plan.loadOrder.indexOf("User")).toBeLessThan(plan.loadOrder.indexOf("Post"));
    expect(plan.loadOrder.indexOf("Post")).toBeLessThan(plan.loadOrder.indexOf("Comment"));
    expect(plan.cyclicFks).toEqual([
      { table: "Post", columns: ["quotedPostId"] },
      { table: "User", columns: ["invitedById"] },
    ]);
  });
});

describe("restorableTables", () => {
  it("excludes Prisma's migration bookkeeping but keeps every app table", () => {
    const header = { tables: [table("User"), table("_prisma_migrations"), table("Post")] };
    expect(restorableTables(header).map((t) => t.name)).toEqual(["User", "Post"]);
  });
});

describe("Queryable contract", () => {
  it("is structurally satisfied by a plain object with a query method", async () => {
    const fake: Queryable = {
      query: async <T>() => ({ rows: [] as T[] }),
    };
    const result = await fake.query<{ a: number }>("SELECT 1");
    expect(result.rows).toEqual([]);
    expect(fake).toBeDefined();
  });
});
