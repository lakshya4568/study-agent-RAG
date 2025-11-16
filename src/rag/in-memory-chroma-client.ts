type Metadata = Record<string, unknown>;
type WhereClause = Record<string, unknown> & {
  $and?: WhereClause[];
  $or?: WhereClause[];
};

interface UpsertArgs {
  ids: string[];
  embeddings?: number[][];
  metadatas?: (Metadata | undefined | null)[];
  documents?: (string | undefined)[];
}

interface DeleteArgs {
  ids?: string[];
  where?: WhereClause;
}

interface QueryArgs {
  queryEmbeddings?: number[][];
  nResults?: number;
  where?: WhereClause;
}

interface QueryReturn {
  ids: string[][];
  distances: number[][];
  documents: (string | null)[][];
  metadatas: (Metadata | null)[][];
}

interface StoredRecord {
  id: string;
  embedding: number[];
  metadata?: Metadata;
  document?: string;
}

class InMemoryChromaCollection {
  private readonly records = new Map<string, StoredRecord>();

  async upsert({
    ids,
    embeddings,
    metadatas,
    documents,
  }: UpsertArgs): Promise<void> {
    if (!embeddings) {
      throw new Error("Embedded mode requires precomputed embeddings");
    }

    ids.forEach((id, index) => {
      const metadata = metadatas?.[index] ?? {};
      const document = documents?.[index] ?? "";
      this.records.set(id, {
        id,
        embedding: embeddings[index],
        metadata,
        document,
      });
    });
  }

  async delete(args: DeleteArgs): Promise<void> {
    if (args.ids?.length) {
      for (const id of args.ids) {
        this.records.delete(id);
      }
      return;
    }

    if (args.where) {
      for (const [id, record] of this.records) {
        if (matchesWhere(record.metadata, args.where)) {
          this.records.delete(id);
        }
      }
      return;
    }

    throw new Error("Either ids or where clause must be provided for delete");
  }

  async query({
    queryEmbeddings,
    nResults = 10,
    where,
  }: QueryArgs): Promise<QueryReturn> {
    const queries = queryEmbeddings ?? [];
    const filtered = this.filterRecords(where);

    const ids: string[][] = [];
    const distances: number[][] = [];
    const documents: (string | null)[][] = [];
    const metadatas: (Metadata | null)[][] = [];

    for (const query of queries) {
      const scored = filtered
        .map((record) => ({
          id: record.id,
          distance: cosineDistance(query, record.embedding),
          document: record.document ?? null,
          metadata: record.metadata ?? null,
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, nResults);

      ids.push(scored.map((item) => item.id));
      distances.push(scored.map((item) => item.distance));
      documents.push(scored.map((item) => item.document));
      metadatas.push(scored.map((item) => item.metadata));
    }

    return {
      ids,
      distances,
      documents,
      metadatas,
    };
  }

  private filterRecords(where?: WhereClause): StoredRecord[] {
    if (!where) {
      return [...this.records.values()];
    }

    return [...this.records.values()].filter((record) =>
      matchesWhere(record.metadata, where)
    );
  }
}

export class InMemoryChromaClient {
  private readonly collections = new Map<string, InMemoryChromaCollection>();

  async getOrCreateCollection(options: { name: string }) {
    const name = options.name;
    let collection = this.collections.get(name);
    if (!collection) {
      collection = new InMemoryChromaCollection();
      this.collections.set(name, collection);
    }
    return collection;
  }
}

function matchesWhere(
  metadata: Metadata | undefined,
  where: WhereClause
): boolean {
  if (where.$and?.length) {
    return where.$and.every((clause) => matchesWhere(metadata, clause));
  }

  if (where.$or?.length) {
    return where.$or.some((clause) => matchesWhere(metadata, clause));
  }

  if (!metadata) {
    return false;
  }

  return Object.entries(where).every(([key, value]) => {
    if (key === "$and" || key === "$or") {
      return true;
    }

    if (typeof value === "object" && value !== null) {
      if ("$in" in (value as Record<string, unknown>)) {
        const set = value as { $in: unknown[] };
        return set.$in.some((candidate) => metadata[key] === candidate);
      }
      return metadata[key] === value;
    }
    return metadata[key] === value;
  });
}

function cosineDistance(a: number[], b: number[]): number {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (normA === 0 || normB === 0) {
    return 1;
  }
  const similarity = dot / (normA * normB);
  return 1 - similarity;
}
