import { FileType } from "./FileType";

export interface Plugin {
  onFileChange?: (filePath: string, fileType: FileType) => Promise<void>;
  onServerStart?: () => Promise<void>;
  defaultExtension?: (typescript?: boolean) => string;
  determineEntryFile?: () => Promise<string | null>;
}
