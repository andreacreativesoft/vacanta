import { notFound } from "next/navigation";

import {
  getSearch,
  listChatMessages,
  listSnapshots,
  snapshotTrips,
} from "@/lib/db/queries";
import { SearchDetail } from "@/components/search-detail";
import type {
  ChatMessage,
  SearchDetailDto,
  SnapshotDto,
} from "@/types/dto";
import type { SearchInput } from "@/types";

export const dynamic = "force-dynamic";

export default async function SearchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ snapshot?: string }>;
}) {
  const { id } = await params;
  const { snapshot: snapshotQuery } = await searchParams;

  const search = getSearch(id);
  if (!search) notFound();

  const snapshotRows = listSnapshots(id);
  const snapshots: SnapshotDto[] = snapshotRows.map((s) => ({
    id: s.id,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    errorMessage: s.errorMessage,
    trips: snapshotTrips(s),
  }));

  const detail: SearchDetailDto = {
    search: {
      id: search.id,
      label: search.label,
      createdAt: search.createdAt.toISOString(),
      params: JSON.parse(search.paramsJson) as SearchInput,
    },
    snapshots,
  };

  const chatRows = listChatMessages(id);
  const initialChat: ChatMessage[] = chatRows.map((m) => ({
    id: m.id,
    role: m.role,
    content: extractText(m.contentJson),
    createdAt: m.createdAt.toISOString(),
  }));

  const initialSnapshotId =
    snapshotQuery ??
    snapshots.find((s) => s.status === "running")?.id ??
    null;

  return (
    <SearchDetail
      initial={detail}
      initialChat={initialChat}
      initialSnapshotId={initialSnapshotId}
    />
  );
}

function extractText(json: string): string {
  try {
    const parsed = JSON.parse(json) as { text?: string } | string;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed.text === "string") return parsed.text;
    return JSON.stringify(parsed);
  } catch {
    return json;
  }
}
