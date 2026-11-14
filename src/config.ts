import type { Settings } from "./types";
import limits from "../shared/limits.json";
export const MAX_INPUT_BYTES = limits.maxInputBytes;
export const WARN_INPUT_BYTES = limits.warnInputBytes;
export const MAX_MAPPING_BYTES = limits.maxMappingBytes;
export const MAX_FILES = limits.maxFiles;
export const defaults: Settings = {
  code: "NoCode",
  sourceCode: "Pinyin",
  chinese: "None",
  encoding: "",
  exportEncoding: "",
  sort: "Default",
  descending: false,
  rank: "",
  customFormat: "213 ,nyyy",
  multiCode: "",
  keepEnglish: true,
  keepNumber: true,
  keepPunctuation: false,
  fullWidth: false,
  chineseNumbers: false,
  underscore: false,
  dictionaryId: "",
  dictionaryName: "",
  dictionaryCategory: "",
  dictionaryDescription: "",
  filter: {
    noFilter: true,
    wordLengthFrom: 1,
    wordLengthTo: 9999,
    wordRankFrom: 0,
    wordRankTo: 2147483647,
    wordRankPercentage: 100,
    ignoreEnglish: false,
    ignoreNumber: false,
    ignoreSpace: false,
    ignorePunctuation: false,
    ignoreNoAlphabetCode: false,
    ignoreFirstCJK: false,
    replaceEnglish: false,
    replaceNumber: false,
    replaceSpace: false,
    replacePunctuation: false,
  },
};
