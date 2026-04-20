export type AppRole = "admin" | "user";
export type TrackSource = "youtube" | "upload";
export type QueueStatus = "pending" | "playing" | "played" | "skipped";
export type MessageType = "chat" | "request" | "system";

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueueItem {
  id: string;
  source: TrackSource;
  external_id: string | null;
  file_url: string | null;
  title: string;
  artist: string | null;
  thumbnail: string | null;
  duration_seconds: number | null;
  position: number;
  requested_by: string | null;
  status: QueueStatus;
  created_at: string;
}

export interface PlaybackState {
  id: number;
  current_queue_id: string | null;
  started_at: string | null;
  is_playing: boolean;
  updated_at: string;
}

export interface Message {
  id: string;
  user_id: string | null;
  content: string;
  type: MessageType;
  queue_id: string | null;
  created_at: string;
}
