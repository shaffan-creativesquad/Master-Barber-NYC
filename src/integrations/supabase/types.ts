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
      appointments: {
        Row: {
          barber_id: string
          cancellation_fee_charged_cents: number
          created_at: string
          customer_id: string
          duration_min: number
          ends_at: string
          id: string
          location_id: string
          no_show_fee_charged_cents: number
          notes: string | null
          price_cents: number
          service_id: string
          square_card_id: string | null
          square_customer_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          stripe_payment_method_id: string | null
          stripe_setup_intent_id: string | null
          updated_at: string
        }
        Insert: {
          barber_id: string
          cancellation_fee_charged_cents?: number
          created_at?: string
          customer_id: string
          duration_min: number
          ends_at: string
          id?: string
          location_id: string
          no_show_fee_charged_cents?: number
          notes?: string | null
          price_cents: number
          service_id: string
          square_card_id?: string | null
          square_customer_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          stripe_payment_method_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          barber_id?: string
          cancellation_fee_charged_cents?: number
          created_at?: string
          customer_id?: string
          duration_min?: number
          ends_at?: string
          id?: string
          location_id?: string
          no_show_fee_charged_cents?: number
          notes?: string | null
          price_cents?: number
          service_id?: string
          square_card_id?: string | null
          square_customer_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          stripe_payment_method_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_breaks: {
        Row: {
          barber_id: string
          date: string | null
          end_time: string
          id: string
          start_time: string
          weekday: number | null
        }
        Insert: {
          barber_id: string
          date?: string | null
          end_time: string
          id?: string
          start_time: string
          weekday?: number | null
        }
        Update: {
          barber_id?: string
          date?: string | null
          end_time?: string
          id?: string
          start_time?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "barber_breaks_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_locations: {
        Row: {
          barber_id: string
          location_id: string
        }
        Insert: {
          barber_id: string
          location_id: string
        }
        Update: {
          barber_id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_locations_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_schedules: {
        Row: {
          barber_id: string
          end_time: string
          id: string
          location_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          barber_id: string
          end_time: string
          id?: string
          location_id: string
          start_time: string
          weekday: number
        }
        Update: {
          barber_id?: string
          end_time?: string
          id?: string
          location_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "barber_schedules_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_services: {
        Row: {
          barber_id: string
          service_id: string
        }
        Insert: {
          barber_id: string
          service_id: string
        }
        Update: {
          barber_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_time_off: {
        Row: {
          barber_id: string
          end_at: string
          id: string
          reason: string | null
          start_at: string
        }
        Insert: {
          barber_id: string
          end_at: string
          id?: string
          reason?: string | null
          start_at: string
        }
        Update: {
          barber_id?: string
          end_at?: string
          id?: string
          reason?: string | null
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_time_off_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          active: boolean
          bio: string | null
          created_at: string
          experience_years: number | null
          id: string
          name: string
          photo_url: string | null
          sort_order: number
          specialty: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          bio?: string | null
          created_at?: string
          experience_years?: number | null
          id?: string
          name: string
          photo_url?: string | null
          sort_order?: number
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          bio?: string | null
          created_at?: string
          experience_years?: number | null
          id?: string
          name?: string
          photo_url?: string | null
          sort_order?: number
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          auto_confirm: boolean
          cancellation_fee_cents: number
          cancellation_window_hours: number
          deposit_cents: number
          id: boolean
          max_days_ahead: number
          no_show_fee_cents: number
          require_card: boolean
          require_deposit: boolean
          updated_at: string
        }
        Insert: {
          auto_confirm?: boolean
          cancellation_fee_cents?: number
          cancellation_window_hours?: number
          deposit_cents?: number
          id?: boolean
          max_days_ahead?: number
          no_show_fee_cents?: number
          require_card?: boolean
          require_deposit?: boolean
          updated_at?: string
        }
        Update: {
          auto_confirm?: boolean
          cancellation_fee_cents?: number
          cancellation_window_hours?: number
          deposit_cents?: number
          id?: boolean
          max_days_ahead?: number
          no_show_fee_cents?: number
          require_card?: boolean
          require_deposit?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          barber_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          matched_via: string
          reason: string | null
          receipt_photo_path: string | null
          result: string
          staff_user_id: string | null
          tip_amount_cents: number
          tip_payment_id: string | null
          tip_payment_method: string | null
        }
        Insert: {
          barber_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          matched_via: string
          reason?: string | null
          receipt_photo_path?: string | null
          result: string
          staff_user_id?: string | null
          tip_amount_cents?: number
          tip_payment_id?: string | null
          tip_payment_method?: string | null
        }
        Update: {
          barber_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          matched_via?: string
          reason?: string | null
          receipt_photo_path?: string | null
          result?: string
          staff_user_id?: string | null
          tip_amount_cents?: number
          tip_payment_id?: string | null
          tip_payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          imported_from: string | null
          last_name: string
          member_code: string | null
          phone: string
          photo_url: string | null
          square_card_id: string | null
          square_customer_id: string | null
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          imported_from?: string | null
          last_name: string
          member_code?: string | null
          phone: string
          photo_url?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          imported_from?: string | null
          last_name?: string
          member_code?: string | null
          phone?: string
          photo_url?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          date: string
          id: string
          location_id: string | null
          reason: string | null
        }
        Insert: {
          date: string
          id?: string
          location_id?: string | null
          reason?: string | null
        }
        Update: {
          date?: string
          id?: string
          location_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_hours: {
        Row: {
          close_time: string | null
          closed: boolean
          id: string
          location_id: string
          open_time: string | null
          weekday: number
        }
        Insert: {
          close_time?: string | null
          closed?: boolean
          id?: string
          location_id: string
          open_time?: string | null
          weekday: number
        }
        Update: {
          close_time?: string | null
          closed?: boolean
          id?: string
          location_id?: string
          open_time?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "location_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address: string
          created_at: string
          id: string
          name: string
          phone: string | null
          sort_order: number
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          sort_order?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          sort_order?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      membership_refunds: {
        Row: {
          amount_cents: number
          created_at: string
          customer_id: string
          id: string
          idempotency_key: string
          kind: string
          membership_id: string
          reason: string
          square_payment_id: string
          square_refund_id: string | null
          staff_user_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          customer_id: string
          id?: string
          idempotency_key: string
          kind?: string
          membership_id: string
          reason: string
          square_payment_id: string
          square_refund_id?: string | null
          staff_user_id: string
          status: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          customer_id?: string
          id?: string
          idempotency_key?: string
          kind?: string
          membership_id?: string
          reason?: string
          square_payment_id?: string
          square_refund_id?: string | null
          staff_user_id?: string
          status?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          billing_day: number
          billing_invite_sent_at: string | null
          created_at: string
          current_period_end: string | null
          customer_id: string
          expiration_edit_count: number
          first_expiration_edit_at: string | null
          first_payment_id: string | null
          id: string
          last_card_payment_id: string | null
          last_payment_method: string | null
          last_renewed_at: string | null
          needs_review: boolean
          plan_id: string
          refund_access_ended_at: string | null
          source: string
          square_card_id: string | null
          square_customer_id: string | null
          square_subscription_id: string | null
          status: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          tip_cents: number
          updated_at: string
        }
        Insert: {
          billing_day?: number
          billing_invite_sent_at?: string | null
          created_at?: string
          current_period_end?: string | null
          customer_id: string
          expiration_edit_count?: number
          first_expiration_edit_at?: string | null
          first_payment_id?: string | null
          id?: string
          last_card_payment_id?: string | null
          last_payment_method?: string | null
          last_renewed_at?: string | null
          needs_review?: boolean
          plan_id: string
          refund_access_ended_at?: string | null
          source?: string
          square_card_id?: string | null
          square_customer_id?: string | null
          square_subscription_id?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          tip_cents?: number
          updated_at?: string
        }
        Update: {
          billing_day?: number
          billing_invite_sent_at?: string | null
          created_at?: string
          current_period_end?: string | null
          customer_id?: string
          expiration_edit_count?: number
          first_expiration_edit_at?: string | null
          first_payment_id?: string | null
          id?: string
          last_card_payment_id?: string | null
          last_payment_method?: string | null
          last_renewed_at?: string | null
          needs_review?: boolean
          plan_id?: string
          refund_access_ended_at?: string | null
          source?: string
          square_card_id?: string | null
          square_customer_id?: string | null
          square_subscription_id?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          tip_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_migration_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          membership_id: string | null
          new_amount_cents: number | null
          old_amount_cents: number | null
          provider: string
          run_id: string
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          membership_id?: string | null
          new_amount_cents?: number | null
          old_amount_cents?: number | null
          provider: string
          run_id: string
          status: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          membership_id?: string | null
          new_amount_cents?: number | null
          old_amount_cents?: number | null
          provider?: string
          run_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_migration_log_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          buffer_min: number
          category: string
          created_at: string
          description: string | null
          duration_min: number
          id: string
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          buffer_min?: number
          category?: string
          created_at?: string
          description?: string | null
          duration_min: number
          id?: string
          name: string
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          buffer_min?: number
          category?: string
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff"
      appointment_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "cancelled"
        | "no_show"
      membership_status: "active" | "past_due" | "canceled" | "incomplete"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "staff"],
      appointment_status: [
        "pending",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "no_show",
      ],
      membership_status: ["active", "past_due", "canceled", "incomplete"],
    },
  },
} as const
