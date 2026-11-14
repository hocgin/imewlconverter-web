export type Format = {
  id: string;
  displayName: string;
  fileExtension: string;
  isBinary: boolean;
  supportsImport: boolean;
  supportsExport: boolean;
  sortOrder: number;
};
export type Capabilities = {
  importers: Format[];
  exporters: Format[];
  generators: { id: string; name: string }[];
};
export type Filter = {
  noFilter: boolean;
  wordLengthFrom: number;
  wordLengthTo: number;
  wordRankFrom: number;
  wordRankTo: number;
  wordRankPercentage: number;
  ignoreEnglish: boolean;
  ignoreNumber: boolean;
  ignoreSpace: boolean;
  ignorePunctuation: boolean;
  ignoreNoAlphabetCode: boolean;
  ignoreFirstCJK: boolean;
  replaceEnglish: boolean;
  replaceNumber: boolean;
  replaceSpace: boolean;
  replacePunctuation: boolean;
};
export type Settings = {
  code: string;
  sourceCode: string;
  chinese: string;
  encoding: string;
  exportEncoding: string;
  sort: string;
  descending: boolean;
  rank: string;
  customFormat: string;
  multiCode: string;
  keepEnglish: boolean;
  keepNumber: boolean;
  keepPunctuation: boolean;
  fullWidth: boolean;
  chineseNumbers: boolean;
  underscore: boolean;
  dictionaryId: string;
  dictionaryName: string;
  dictionaryCategory: string;
  dictionaryDescription: string;
  filter: Filter;
};
export type Output = {
  name: string;
  data: Uint8Array;
  imported: number;
  exported: number;
  exportErrors: number;
  warnings: string[];
  elapsedMs: number;
  preview: string | null;
  isBinary: boolean;
  source: string;
};
export type ConversionRequest = {
  files: File[];
  from: string;
  to: string;
  mode: "merge" | "separate";
  settings: Settings;
  mapping: File | null;
};
export type Progress = { stage: string; current?: number; total?: number };
export type Status =
  | "loading"
  | "ready"
  | "converting"
  | "cancelled"
  | "success"
  | "partial"
  | "error";
