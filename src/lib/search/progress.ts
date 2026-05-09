import "server-only";

import type { ProgressEvent } from "@/types";

export type ProgressEmitter = (event: ProgressEvent) => void;

export function sseFormat(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function eventToSse(event: ProgressEvent): string {
  return sseFormat(event.type, event);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
