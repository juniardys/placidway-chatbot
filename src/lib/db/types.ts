export type SourceMetadata = {
  sourceId: string;
  title: string;
  url: string;
  pageType?: string;
  section?: string;
  fetchedAt?: string;
  contentHash?: string;
};

export type RetrievedChunk = SourceMetadata & {
  id: string;
  content: string;
  similarity: number;
  active?: boolean;
};

export type ChatLogInput = {
  question: string;
  status: string;
  confidence?: number;
};

export type SourceSnapshotInput = {
  id?: string;
  sourceId: string;
  rawContent: string;
  normalizedMarkdown: string;
  contentHash: string;
  status?: string;
};

export type ChunkInput = {
  sourceId: string;
  snapshotId: string;
  content: string;
  embedding: number[];
  section?: string | null;
  contentHash?: string | null;
};

export type AtomicRefreshSource = { sourceId: string; rawContent: string; normalizedMarkdown: string; contentHash: string; chunks: ChunkInput[] };

export type Repository = {
  getActiveChunks(queryEmbedding: number[], limit: number): Promise<RetrievedChunk[]>;
  getActiveHashes(): Promise<Record<string, string>>;
  refreshAtomically(sources: AtomicRefreshSource[]): Promise<void>;
  insertSourceSnapshot(input: SourceSnapshotInput): Promise<string>;
  insertChunks(input: ChunkInput[] | ChunkInput): Promise<void>;
  activateSnapshot(snapshotId: string): Promise<void>;
  logChatOutcome(input: ChatLogInput): Promise<void>;
};

export type RepositoryClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ 
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
};
