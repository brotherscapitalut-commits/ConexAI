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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          region: Database["public"]["Enums"]["block_region"]
          reserved_until: string | null
          status: Database["public"]["Enums"]["block_status"]
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          region?: Database["public"]["Enums"]["block_region"]
          reserved_until?: string | null
          status?: Database["public"]["Enums"]["block_status"]
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          region?: Database["public"]["Enums"]["block_region"]
          reserved_until?: string | null
          status?: Database["public"]["Enums"]["block_status"]
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clicks: {
        Row: {
          anonymized_ip: string | null
          block_x: number | null
          block_y: number | null
          company_id: string
          created_at: string
          id: string
          source: string
        }
        Insert: {
          anonymized_ip?: string | null
          block_x?: number | null
          block_y?: number | null
          company_id: string
          created_at?: string
          id?: string
          source?: string
        }
        Update: {
          anonymized_ip?: string | null
          block_x?: number | null
          block_y?: number | null
          company_id?: string
          created_at?: string
          id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "clicks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          id: string
          user_id: string | null
          email: string
          role: "admin" | "super_admin"
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          role?: "admin" | "super_admin"
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          role?: "admin" | "super_admin"
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          avg_budget: string | null
          category: string
          color: string
          contact_email: string | null
          contact_whatsapp: string | null
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          instagram: string | null
          logo_initials: string
          logo_url: string | null
          moderation_notes: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          mural_type: Database["public"]["Enums"]["mural_type"]
          name: string
          owner_id: string
          product_service: string | null
          region: string | null
          target_audience: string | null
          tiktok: string | null
          updated_at: string
          website: string
          youtube: string | null
        }
        Insert: {
          avg_budget?: string | null
          category: string
          color?: string
          contact_email?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          instagram?: string | null
          logo_initials?: string
          logo_url?: string | null
          moderation_notes?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          mural_type?: Database["public"]["Enums"]["mural_type"]
          name: string
          owner_id: string
          product_service?: string | null
          region?: string | null
          target_audience?: string | null
          tiktok?: string | null
          updated_at?: string
          website: string
          youtube?: string | null
        }
        Update: {
          avg_budget?: string | null
          category?: string
          color?: string
          contact_email?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          instagram?: string | null
          logo_initials?: string
          logo_url?: string | null
          moderation_notes?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          mural_type?: Database["public"]["Enums"]["mural_type"]
          name?: string
          owner_id?: string
          product_service?: string | null
          region?: string | null
          target_audience?: string | null
          tiktok?: string | null
          updated_at?: string
          website?: string
          youtube?: string | null
        }
        Relationships: []
      }
      contact_events: {
        Row: {
          contact_type: string
          created_at: string
          from_user_id: string
          id: string
          to_company_id: string | null
          to_influencer_id: string | null
        }
        Insert: {
          contact_type?: string
          created_at?: string
          from_user_id: string
          id?: string
          to_company_id?: string | null
          to_influencer_id?: string | null
        }
        Update: {
          contact_type?: string
          created_at?: string
          from_user_id?: string
          id?: string
          to_company_id?: string | null
          to_influencer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_events_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_events_to_influencer_id_fkey"
            columns: ["to_influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          influencer_id: string | null
          initiated_by: string
          last_message_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          influencer_id?: string | null
          initiated_by: string
          last_message_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          influencer_id?: string | null
          initiated_by?: string
          last_message_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_interactions: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          interaction_type: string
          lead_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          interaction_type?: string
          lead_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          interaction_type?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          address: string | null
          assigned_to: string | null
          business_sector: string | null
          city: string | null
          cnpj: string | null
          company_name: string
          company_size: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          created_by: string
          email: string | null
          employee_count: number | null
          estimated_revenue: string | null
          id: string
          last_interaction_at: string | null
          lead_source: string | null
          linked_company_id: string | null
          notes: string | null
          phone: string | null
          state: string | null
          status: Database["public"]["Enums"]["crm_lead_status"]
          tags: string[] | null
          updated_at: string
          website: string | null
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          business_sector?: string | null
          city?: string | null
          cnpj?: string | null
          company_name: string
          company_size?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          employee_count?: number | null
          estimated_revenue?: string | null
          id?: string
          last_interaction_at?: string | null
          lead_source?: string | null
          linked_company_id?: string | null
          notes?: string | null
          phone?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["crm_lead_status"]
          tags?: string[] | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          business_sector?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string
          company_size?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          employee_count?: number | null
          estimated_revenue?: string | null
          id?: string
          last_interaction_at?: string | null
          lead_source?: string | null
          linked_company_id?: string | null
          notes?: string | null
          phone?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["crm_lead_status"]
          tags?: string[] | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_linked_company_id_fkey"
            columns: ["linked_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          avg_engagement: number | null
          bio: string | null
          category: string
          color: string
          contact_email: string | null
          contact_whatsapp: string | null
          created_at: string
          followers_count: number | null
          id: string
          instagram: string | null
          logo_initials: string
          moderation_notes: string | null
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          mural_type: Database["public"]["Enums"]["mural_type"]
          name: string
          niche: string | null
          owner_id: string
          photo_url: string | null
          portfolio_url: string | null
          region: string | null
          tiktok: string | null
          twitter: string | null
          updated_at: string
          website: string | null
          youtube: string | null
        }
        Insert: {
          avg_engagement?: number | null
          bio?: string | null
          category: string
          color?: string
          contact_email?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          followers_count?: number | null
          id?: string
          instagram?: string | null
          logo_initials?: string
          moderation_notes?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          mural_type?: Database["public"]["Enums"]["mural_type"]
          name: string
          niche?: string | null
          owner_id: string
          photo_url?: string | null
          portfolio_url?: string | null
          region?: string | null
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string
          website?: string | null
          youtube?: string | null
        }
        Update: {
          avg_engagement?: number | null
          bio?: string | null
          category?: string
          color?: string
          contact_email?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          followers_count?: number | null
          id?: string
          instagram?: string | null
          logo_initials?: string
          moderation_notes?: string | null
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          mural_type?: Database["public"]["Enums"]["mural_type"]
          name?: string
          niche?: string | null
          owner_id?: string
          photo_url?: string | null
          portfolio_url?: string | null
          region?: string | null
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string
          website?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          blocks_count: number
          company_id: string
          created_at: string
          id: string
          region: Database["public"]["Enums"]["block_region"]
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          blocks_count: number
          company_id: string
          created_at?: string
          id?: string
          region: Database["public"]["Enums"]["block_region"]
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          blocks_count?: number
          company_id?: string
          created_at?: string
          id?: string
          region?: Database["public"]["Enums"]["block_region"]
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_approved: boolean
          updated_at: string
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_approved?: boolean
          updated_at?: string
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_approved?: boolean
          updated_at?: string
          user_id?: string
          waitlist_position?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      favorite_influencers: {
        Row: {
          company_id: string
          created_at: string
          id: string
          influencer_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          influencer_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          influencer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_influencers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_influencers_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "advertiser" | "user"
      block_region: "borda" | "intermediaria" | "centro_premium"
      block_status: "free" | "reserved" | "occupied"
      crm_lead_status:
        | "lead"
        | "contato"
        | "negociacao"
        | "proposta"
        | "cliente"
        | "perdido"
      moderation_status: "pending" | "approved" | "rejected"
      mural_type: "empresas" | "influencers"
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
      app_role: ["admin", "advertiser", "user"],
      block_region: ["borda", "intermediaria", "centro_premium"],
      block_status: ["free", "reserved", "occupied"],
      crm_lead_status: [
        "lead",
        "contato",
        "negociacao",
        "proposta",
        "cliente",
        "perdido",
      ],
      moderation_status: ["pending", "approved", "rejected"],
      mural_type: ["empresas", "influencers"],
    },
  },
} as const
