export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          guest_name: string | null
          id: string
          queue_id: string | null
          type: Database["public"]["Enums"]["message_type"]
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          guest_name?: string | null
          id?: string
          queue_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          guest_name?: string | null
          id?: string
          queue_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queue"
            referencedColumns: ["id"]
          },
        ]
      }
      playback_state: {
        Row: {
          current_queue_id: string | null
          id: number
          is_playing: boolean
          started_at: string | null
          updated_at: string
        }
        Insert: {
          current_queue_id?: string | null
          id?: number
          is_playing?: boolean
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          current_queue_id?: string | null
          id?: number
          is_playing?: boolean
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playback_state_current_queue_id_fkey"
            columns: ["current_queue_id"]
            isOneToOne: false
            referencedRelation: "queue"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banned: boolean
          created_at: string
          id: string
          temp_ban_until: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned?: boolean
          created_at?: string
          id: string
          temp_ban_until?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned?: boolean
          created_at?: string
          id?: string
          temp_ban_until?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      queue: {
        Row: {
          artist: string | null
          created_at: string
          duration_seconds: number | null
          external_id: string | null
          file_url: string | null
          id: string
          position: number
          requested_by: string | null
          source: Database["public"]["Enums"]["track_source"]
          status: Database["public"]["Enums"]["queue_status"]
          thumbnail: string | null
          title: string
        }
        Insert: {
          artist?: string | null
          created_at?: string
          duration_seconds?: number | null
          external_id?: string | null
          file_url?: string | null
          id?: string
          position?: number
          requested_by?: string | null
          source: Database["public"]["Enums"]["track_source"]
          status?: Database["public"]["Enums"]["queue_status"]
          thumbnail?: string | null
          title: string
        }
        Update: {
          artist?: string | null
          created_at?: string
          duration_seconds?: number | null
          external_id?: string | null
          file_url?: string | null
          id?: string
          position?: number
          requested_by?: string | null
          source?: Database["public"]["Enums"]["track_source"]
          status?: Database["public"]["Enums"]["queue_status"]
          thumbnail?: string | null
          title?: string
        }
        Relationships: []
      }
      queue_upvotes: {
        Row: {
          created_at: string
          id: string
          queue_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          queue_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          queue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_upvotes_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queue"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_playlist_runs: {
        Row: {
          created_at: string
          id: string
          items_enqueued: number
          playlist_id: string
          run_hour: string
        }
        Insert: {
          created_at?: string
          id?: string
          items_enqueued?: number
          playlist_id: string
          run_hour: string
        }
        Update: {
          created_at?: string
          id?: string
          items_enqueued?: number
          playlist_id?: string
          run_hour?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_playlist_runs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "scheduled_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_playlists: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          id: string
          items: Json
          name: string
          start_hour: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          id?: string
          items?: Json
          name: string
          start_hour: number
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          id?: string
          items?: Json
          name?: string
          start_hour?: number
        }
        Relationships: []
      }
      skip_votes: {
        Row: {
          created_at: string
          id: string
          queue_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          queue_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          queue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skip_votes_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queue"
            referencedColumns: ["id"]
          },
        ]
      }
      track_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          queue_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          queue_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          queue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_reactions_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queue"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      word_filters: {
        Row: {
          created_at: string
          id: string
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_queue: { Args: { expected_current?: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      message_type: "chat" | "request" | "system"
      queue_status: "pending" | "playing" | "played" | "skipped"
      track_source: "youtube" | "upload"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      message_type: ["chat", "request", "system"],
      queue_status: ["pending", "playing", "played", "skipped"],
      track_source: ["youtube", "upload"],
    },
  },
} as const
