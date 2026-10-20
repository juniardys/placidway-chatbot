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
  text: string;
  score: number;
  active?: boolean;
};

export type ChatLogInput = {
  question: string;
  status: string;
  confidence?: number;
};

export type RepositoryClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
};
