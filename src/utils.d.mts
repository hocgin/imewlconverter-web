import type { Settings } from "./types";
export function fileSize(bytes: number): string;
export function detectFormat(name: string): string | null;
export function inputValidationMessage(format: string, bytes: Uint8Array): string;
export function conversionErrorMessage(message: string, names: string[]): string;
export function uniqueName(name: string, used: Set<string>): string;
export function validationMessage(
  settings: Settings,
  mapping: File | null,
): string;
