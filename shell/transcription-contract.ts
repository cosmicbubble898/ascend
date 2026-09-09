export type Stage =
  | "empty"
  | "selected"
  | "loading"
  | "running"
  | "canceling"
  | "complete"
  | "canceled"
  | "error";
export interface SelectedAudio {
  name: string;
  bytes: number;
  token: string;
}
export interface TranscriptionSnapshot {
  stage: Stage;
  file: SelectedAudio | null;
  duration: number | null;
  processed: number;
  text: string;
  error: string | null;
}
export interface TranscriptionBridge {
  state(): Promise<TranscriptionSnapshot>;
  choose(): Promise<void>;
  start(token: string): Promise<void>;
  cancel(): Promise<void>;
  clear(): Promise<void>;
  save(): Promise<boolean>;
  subscribe(callback: (state: TranscriptionSnapshot) => void): () => void;
}
