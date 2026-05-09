import type { SearchInput, TripOption } from "./index";

export type SearchDto = {
  id: string;
  label: string | null;
  createdAt: string;
  params: SearchInput;
};

export type SnapshotDto = {
  id: string;
  status: "running" | "complete" | "error";
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  trips: TripOption[];
};

export type SearchListItemDto = {
  id: string;
  label: string | null;
  createdAt: string;
  params: SearchInput;
  latestSnapshot: {
    id: string;
    status: SnapshotDto["status"];
    startedAt: string;
    completedAt: string | null;
    tripCount: number;
    cheapest: number | null;
  } | null;
};

export type SearchDetailDto = {
  search: SearchDto;
  snapshots: SnapshotDto[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
};
