export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      account_capabilities: {
        Row: {
          capability_name: string;
          created_at: string | null;
          granted_at: string;
          granted_by: string | null;
          id: string;
          metadata: Json | null;
          notes: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          capability_name: string;
          created_at?: string | null;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          capability_name?: string;
          created_at?: string | null;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_capabilities_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'account_capabilities_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_capabilities_revoked_by_fkey';
            columns: ['revoked_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'account_capabilities_revoked_by_fkey';
            columns: ['revoked_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_capabilities_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'account_capabilities_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_actions_log: {
        Row: {
          action_details: Json | null;
          action_type: string;
          admin_email: string;
          created_at: string | null;
          id: string;
          target_user_email: string | null;
        };
        Insert: {
          action_details?: Json | null;
          action_type: string;
          admin_email: string;
          created_at?: string | null;
          id?: string;
          target_user_email?: string | null;
        };
        Update: {
          action_details?: Json | null;
          action_type?: string;
          admin_email?: string;
          created_at?: string | null;
          id?: string;
          target_user_email?: string | null;
        };
        Relationships: [];
      };
      agent_sessions: {
        Row: {
          conversation_history: Json;
          created_at: string;
          id: string;
          metadata: Json | null;
          session_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          conversation_history?: Json;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          session_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversation_history?: Json;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          session_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'agent_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      anne_user_memory: {
        Row: {
          communication_style: Json;
          created_at: string | null;
          default_sender: Json;
          id: string;
          notes: string | null;
          preferences: Json;
          preferred_couriers: string[];
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          communication_style?: Json;
          created_at?: string | null;
          default_sender?: Json;
          id?: string;
          notes?: string | null;
          preferences?: Json;
          preferred_couriers?: string[];
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          communication_style?: Json;
          created_at?: string | null;
          default_sender?: Json;
          id?: string;
          notes?: string | null;
          preferences?: Json;
          preferred_couriers?: string[];
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'anne_user_memory_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'anne_user_memory_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      api_audit_log: {
        Row: {
          api_key_id: string | null;
          endpoint: string;
          error_message: string | null;
          id: string;
          ip_address: unknown;
          method: string;
          response_time_ms: number | null;
          status_code: number | null;
          timestamp: string;
          user_agent: string | null;
        };
        Insert: {
          api_key_id?: string | null;
          endpoint: string;
          error_message?: string | null;
          id?: string;
          ip_address?: unknown;
          method: string;
          response_time_ms?: number | null;
          status_code?: number | null;
          timestamp?: string;
          user_agent?: string | null;
        };
        Update: {
          api_key_id?: string | null;
          endpoint?: string;
          error_message?: string | null;
          id?: string;
          ip_address?: unknown;
          method?: string;
          response_time_ms?: number | null;
          status_code?: number | null;
          timestamp?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'api_audit_log_api_key_id_fkey';
            columns: ['api_key_id'];
            isOneToOne: false;
            referencedRelation: 'api_keys';
            referencedColumns: ['id'];
          },
        ];
      };
      api_keys: {
        Row: {
          created_at: string;
          created_by_ip: unknown;
          description: string | null;
          expires_at: string | null;
          id: string;
          key_hash: string;
          key_prefix: string;
          last_used_at: string | null;
          name: string;
          rate_limit_per_hour: number;
          revoked_at: string | null;
          scopes: string[];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by_ip?: unknown;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash: string;
          key_prefix: string;
          last_used_at?: string | null;
          name: string;
          rate_limit_per_hour?: number;
          revoked_at?: string | null;
          scopes?: string[];
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by_ip?: unknown;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash?: string;
          key_prefix?: string;
          last_used_at?: string | null;
          name?: string;
          rate_limit_per_hour?: number;
          revoked_at?: string | null;
          scopes?: string[];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'api_keys_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'api_keys_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string | null;
          created_at: string | null;
          endpoint: string | null;
          id: string;
          ip_address: unknown;
          message: string;
          metadata: Json | null;
          resource_id: string | null;
          resource_type: string | null;
          severity: string;
          stack_trace: string | null;
          user_email: string | null;
          user_id: string | null;
        };
        Insert: {
          action?: string | null;
          created_at?: string | null;
          endpoint?: string | null;
          id?: string;
          ip_address?: unknown;
          message: string;
          metadata?: Json | null;
          resource_id?: string | null;
          resource_type?: string | null;
          severity: string;
          stack_trace?: string | null;
          user_email?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string | null;
          created_at?: string | null;
          endpoint?: string | null;
          id?: string;
          ip_address?: unknown;
          message?: string;
          metadata?: Json | null;
          resource_id?: string | null;
          resource_type?: string | null;
          severity?: string;
          stack_trace?: string | null;
          user_email?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      automation_locks: {
        Row: {
          config_id: string;
          created_at: string | null;
          expires_at: string;
          id: string;
          is_active: boolean | null;
          lock_type: string;
          locked_at: string | null;
          locked_by: string | null;
          reason: string | null;
          released_at: string | null;
        };
        Insert: {
          config_id: string;
          created_at?: string | null;
          expires_at: string;
          id?: string;
          is_active?: boolean | null;
          lock_type: string;
          locked_at?: string | null;
          locked_by?: string | null;
          reason?: string | null;
          released_at?: string | null;
        };
        Update: {
          config_id?: string;
          created_at?: string | null;
          expires_at?: string;
          id?: string;
          is_active?: boolean | null;
          lock_type?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          reason?: string | null;
          released_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'automation_locks_config_id_fkey';
            columns: ['config_id'];
            isOneToOne: false;
            referencedRelation: 'courier_configs';
            referencedColumns: ['id'];
          },
        ];
      };
      compensation_queue: {
        Row: {
          action: string;
          carrier: string;
          completed_at: string | null;
          created_at: string | null;
          dead_letter_reason: string | null;
          error_context: Json | null;
          id: string;
          last_retry_at: string | null;
          max_retries: number | null;
          next_retry_at: string | null;
          original_cost: number | null;
          provider_id: string | null;
          resolved_at: string | null;
          retry_count: number | null;
          shipment_id_external: string;
          status: string | null;
          tracking_number: string;
          user_id: string;
        };
        Insert: {
          action: string;
          carrier: string;
          completed_at?: string | null;
          created_at?: string | null;
          dead_letter_reason?: string | null;
          error_context?: Json | null;
          id?: string;
          last_retry_at?: string | null;
          max_retries?: number | null;
          next_retry_at?: string | null;
          original_cost?: number | null;
          provider_id?: string | null;
          resolved_at?: string | null;
          retry_count?: number | null;
          shipment_id_external: string;
          status?: string | null;
          tracking_number: string;
          user_id: string;
        };
        Update: {
          action?: string;
          carrier?: string;
          completed_at?: string | null;
          created_at?: string | null;
          dead_letter_reason?: string | null;
          error_context?: Json | null;
          id?: string;
          last_retry_at?: string | null;
          max_retries?: number | null;
          next_retry_at?: string | null;
          original_cost?: number | null;
          provider_id?: string | null;
          resolved_at?: string | null;
          retry_count?: number | null;
          shipment_id_external?: string;
          status?: string | null;
          tracking_number?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'compensation_queue_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'compensation_queue_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      cost_validations: {
        Row: {
          api_price: number;
          config_id: string | null;
          contract_code: string | null;
          courier_code: string;
          created_at: string | null;
          created_by: string | null;
          db_price: number;
          destination_province: string | null;
          destination_zip: string | null;
          id: string;
          listino_synced: boolean | null;
          metadata: Json | null;
          price_difference: number | null;
          price_difference_percent: number | null;
          requires_attention: boolean | null;
          shipment_id: string | null;
          synced_at: string | null;
          threshold_percent: number | null;
          tracking_number: string | null;
          weight: number | null;
        };
        Insert: {
          api_price: number;
          config_id?: string | null;
          contract_code?: string | null;
          courier_code: string;
          created_at?: string | null;
          created_by?: string | null;
          db_price: number;
          destination_province?: string | null;
          destination_zip?: string | null;
          id?: string;
          listino_synced?: boolean | null;
          metadata?: Json | null;
          price_difference?: number | null;
          price_difference_percent?: number | null;
          requires_attention?: boolean | null;
          shipment_id?: string | null;
          synced_at?: string | null;
          threshold_percent?: number | null;
          tracking_number?: string | null;
          weight?: number | null;
        };
        Update: {
          api_price?: number;
          config_id?: string | null;
          contract_code?: string | null;
          courier_code?: string;
          created_at?: string | null;
          created_by?: string | null;
          db_price?: number;
          destination_province?: string | null;
          destination_zip?: string | null;
          id?: string;
          listino_synced?: boolean | null;
          metadata?: Json | null;
          price_difference?: number | null;
          price_difference_percent?: number | null;
          requires_attention?: boolean | null;
          shipment_id?: string | null;
          synced_at?: string | null;
          threshold_percent?: number | null;
          tracking_number?: string | null;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cost_validations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'cost_validations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cost_validations_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'anne_all_shipments_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cost_validations_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cost_validations_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments_active';
            referencedColumns: ['id'];
          },
        ];
      };
      courier_configs: {
        Row: {
          account_type: string | null;
          api_key: string;
          api_secret: string | null;
          automation_enabled: boolean | null;
          automation_encrypted: boolean | null;
          automation_settings: Json | null;
          base_url: string;
          carrier: string | null;
          config_label: string | null;
          contract_id: string | null;
          contract_mapping: Json | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          is_default: boolean | null;
          last_automation_sync: string | null;
          last_tested_at: string | null;
          name: string;
          notes: string | null;
          owner_user_id: string | null;
          provider_id: string;
          session_data: Json | null;
          status: string | null;
          test_result: Json | null;
          updated_at: string | null;
        };
        Insert: {
          account_type?: string | null;
          api_key: string;
          api_secret?: string | null;
          automation_enabled?: boolean | null;
          automation_encrypted?: boolean | null;
          automation_settings?: Json | null;
          base_url: string;
          carrier?: string | null;
          config_label?: string | null;
          contract_id?: string | null;
          contract_mapping?: Json | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_default?: boolean | null;
          last_automation_sync?: string | null;
          last_tested_at?: string | null;
          name: string;
          notes?: string | null;
          owner_user_id?: string | null;
          provider_id: string;
          session_data?: Json | null;
          status?: string | null;
          test_result?: Json | null;
          updated_at?: string | null;
        };
        Update: {
          account_type?: string | null;
          api_key?: string;
          api_secret?: string | null;
          automation_enabled?: boolean | null;
          automation_encrypted?: boolean | null;
          automation_settings?: Json | null;
          base_url?: string;
          carrier?: string | null;
          config_label?: string | null;
          contract_id?: string | null;
          contract_mapping?: Json | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_default?: boolean | null;
          last_automation_sync?: string | null;
          last_tested_at?: string | null;
          name?: string;
          notes?: string | null;
          owner_user_id?: string | null;
          provider_id?: string;
          session_data?: Json | null;
          status?: string | null;
          test_result?: Json | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'courier_configs_owner_user_id_fkey';
            columns: ['owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'courier_configs_owner_user_id_fkey';
            columns: ['owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      couriers: {
        Row: {
          active: boolean | null;
          api_endpoint: string | null;
          api_key_required: boolean | null;
          code: string | null;
          created_at: string | null;
          display_name: string;
          estimated_delivery_days_max: number | null;
          estimated_delivery_days_min: number | null;
          id: string;
          is_active: boolean | null;
          logo_url: string | null;
          max_dimensions: Json | null;
          max_weight: number | null;
          min_dimensions: Json | null;
          min_weight: number | null;
          name: string;
          pricing_model: string | null;
          supported_countries: string[] | null;
          supports_cod: boolean | null;
          supports_insurance: boolean | null;
          supports_tracking: boolean | null;
          tracking_url_template: string | null;
          updated_at: string | null;
          website_url: string | null;
        };
        Insert: {
          active?: boolean | null;
          api_endpoint?: string | null;
          api_key_required?: boolean | null;
          code?: string | null;
          created_at?: string | null;
          display_name: string;
          estimated_delivery_days_max?: number | null;
          estimated_delivery_days_min?: number | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          max_dimensions?: Json | null;
          max_weight?: number | null;
          min_dimensions?: Json | null;
          min_weight?: number | null;
          name: string;
          pricing_model?: string | null;
          supported_countries?: string[] | null;
          supports_cod?: boolean | null;
          supports_insurance?: boolean | null;
          supports_tracking?: boolean | null;
          tracking_url_template?: string | null;
          updated_at?: string | null;
          website_url?: string | null;
        };
        Update: {
          active?: boolean | null;
          api_endpoint?: string | null;
          api_key_required?: boolean | null;
          code?: string | null;
          created_at?: string | null;
          display_name?: string;
          estimated_delivery_days_max?: number | null;
          estimated_delivery_days_min?: number | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          max_dimensions?: Json | null;
          max_weight?: number | null;
          min_dimensions?: Json | null;
          min_weight?: number | null;
          name?: string;
          pricing_model?: string | null;
          supported_countries?: string[] | null;
          supports_cod?: boolean | null;
          supports_insurance?: boolean | null;
          supports_tracking?: boolean | null;
          tracking_url_template?: string | null;
          updated_at?: string | null;
          website_url?: string | null;
        };
        Relationships: [];
      };
      diagnostics_events: {
        Row: {
          context: Json | null;
          correlation_id: string | null;
          created_at: string | null;
          id: string;
          ip_address: unknown;
          severity: string | null;
          type: string;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          context?: Json | null;
          correlation_id?: string | null;
          created_at?: string | null;
          id?: string;
          ip_address?: unknown;
          severity?: string | null;
          type: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          context?: Json | null;
          correlation_id?: string | null;
          created_at?: string | null;
          id?: string;
          ip_address?: unknown;
          severity?: string | null;
          type?: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      financial_audit_log: {
        Row: {
          actor_email: string | null;
          actor_id: string | null;
          actor_type: string | null;
          amount: number | null;
          created_at: string | null;
          error_message: string | null;
          event_type: string;
          id: string;
          impersonated_by: string | null;
          ip_address: unknown;
          is_impersonation: boolean | null;
          message: string | null;
          metadata: Json | null;
          new_value: Json | null;
          old_value: Json | null;
          platform_cost_id: string | null;
          price_list_id: string | null;
          request_id: string | null;
          severity: string;
          shipment_id: string | null;
          tracking_number: string | null;
          user_agent: string | null;
          user_email: string | null;
          user_id: string | null;
          wallet_balance_after: number | null;
          wallet_balance_before: number | null;
        };
        Insert: {
          actor_email?: string | null;
          actor_id?: string | null;
          actor_type?: string | null;
          amount?: number | null;
          created_at?: string | null;
          error_message?: string | null;
          event_type: string;
          id?: string;
          impersonated_by?: string | null;
          ip_address?: unknown;
          is_impersonation?: boolean | null;
          message?: string | null;
          metadata?: Json | null;
          new_value?: Json | null;
          old_value?: Json | null;
          platform_cost_id?: string | null;
          price_list_id?: string | null;
          request_id?: string | null;
          severity?: string;
          shipment_id?: string | null;
          tracking_number?: string | null;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          wallet_balance_after?: number | null;
          wallet_balance_before?: number | null;
        };
        Update: {
          actor_email?: string | null;
          actor_id?: string | null;
          actor_type?: string | null;
          amount?: number | null;
          created_at?: string | null;
          error_message?: string | null;
          event_type?: string;
          id?: string;
          impersonated_by?: string | null;
          ip_address?: unknown;
          is_impersonation?: boolean | null;
          message?: string | null;
          metadata?: Json | null;
          new_value?: Json | null;
          old_value?: Json | null;
          platform_cost_id?: string | null;
          price_list_id?: string | null;
          request_id?: string | null;
          severity?: string;
          shipment_id?: string | null;
          tracking_number?: string | null;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          wallet_balance_after?: number | null;
          wallet_balance_before?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'financial_audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_audit_log_impersonated_by_fkey';
            columns: ['impersonated_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'financial_audit_log_impersonated_by_fkey';
            columns: ['impersonated_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_audit_log_platform_cost_id_fkey';
            columns: ['platform_cost_id'];
            isOneToOne: false;
            referencedRelation: 'platform_provider_costs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_audit_log_platform_cost_id_fkey';
            columns: ['platform_cost_id'];
            isOneToOne: false;
            referencedRelation: 'v_platform_margin_alerts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_audit_log_platform_cost_id_fkey';
            columns: ['platform_cost_id'];
            isOneToOne: false;
            referencedRelation: 'v_reconciliation_pending';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_audit_log_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'financial_audit_log_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_audit_log_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
          {
            foreignKeyName: 'financial_audit_log_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'anne_all_shipments_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_audit_log_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_audit_log_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments_active';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_audit_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'financial_audit_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      geo_locations: {
        Row: {
          caps: string[];
          created_at: string | null;
          id: string;
          name: string;
          province: string;
          region: string | null;
          search_vector: unknown;
          updated_at: string | null;
        };
        Insert: {
          caps?: string[];
          created_at?: string | null;
          id?: string;
          name: string;
          province: string;
          region?: string | null;
          search_vector?: unknown;
          updated_at?: string | null;
        };
        Update: {
          caps?: string[];
          created_at?: string | null;
          id?: string;
          name?: string;
          province?: string;
          region?: string | null;
          search_vector?: unknown;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      idempotency_locks: {
        Row: {
          created_at: string;
          expires_at: string;
          idempotency_key: string;
          last_error: string | null;
          metadata: Json | null;
          result_shipment_id: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          idempotency_key: string;
          last_error?: string | null;
          metadata?: Json | null;
          result_shipment_id?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          idempotency_key?: string;
          last_error?: string | null;
          metadata?: Json | null;
          result_shipment_id?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'idempotency_locks_result_shipment_id_fkey';
            columns: ['result_shipment_id'];
            isOneToOne: false;
            referencedRelation: 'anne_all_shipments_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'idempotency_locks_result_shipment_id_fkey';
            columns: ['result_shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'idempotency_locks_result_shipment_id_fkey';
            columns: ['result_shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments_active';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'idempotency_locks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'idempotency_locks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_generation_rules: {
        Row: {
          created_at: string | null;
          generation_type: string;
          id: string;
          include_bank_transfer: boolean | null;
          include_stripe: boolean | null;
          is_active: boolean | null;
          min_amount: number | null;
          period_day: number | null;
          period_frequency: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          generation_type: string;
          id?: string;
          include_bank_transfer?: boolean | null;
          include_stripe?: boolean | null;
          is_active?: boolean | null;
          min_amount?: number | null;
          period_day?: number | null;
          period_frequency?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          generation_type?: string;
          id?: string;
          include_bank_transfer?: boolean | null;
          include_stripe?: boolean | null;
          is_active?: boolean | null;
          min_amount?: number | null;
          period_day?: number | null;
          period_frequency?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_generation_rules_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'invoice_generation_rules_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_items: {
        Row: {
          created_at: string | null;
          description: string;
          id: string;
          invoice_id: string;
          quantity: number | null;
          shipment_id: string | null;
          tax_rate: number | null;
          total: number;
          unit_price: number;
        };
        Insert: {
          created_at?: string | null;
          description: string;
          id?: string;
          invoice_id: string;
          quantity?: number | null;
          shipment_id?: string | null;
          tax_rate?: number | null;
          total: number;
          unit_price: number;
        };
        Update: {
          created_at?: string | null;
          description?: string;
          id?: string;
          invoice_id?: string;
          quantity?: number | null;
          shipment_id?: string | null;
          tax_rate?: number | null;
          total?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_items_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_items_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'anne_all_shipments_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_items_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_items_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments_active';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_recharge_links: {
        Row: {
          amount: number;
          created_at: string | null;
          id: string;
          invoice_id: string;
          wallet_transaction_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          id?: string;
          invoice_id: string;
          wallet_transaction_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          id?: string;
          invoice_id?: string;
          wallet_transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_recharge_links_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_recharge_links_wallet_transaction_id_fkey';
            columns: ['wallet_transaction_id'];
            isOneToOne: true;
            referencedRelation: 'wallet_transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      invoices: {
        Row: {
          amount_paid: number | null;
          created_at: string | null;
          created_by: string | null;
          currency: string | null;
          due_date: string | null;
          id: string;
          internal_notes: string | null;
          invoice_date: string | null;
          invoice_number: string | null;
          invoice_type: string | null;
          notes: string | null;
          pdf_url: string | null;
          period_end: string | null;
          period_start: string | null;
          recipient_address: string | null;
          recipient_city: string | null;
          recipient_country: string | null;
          recipient_name: string | null;
          recipient_pec: string | null;
          recipient_province: string | null;
          recipient_sdi_code: string | null;
          recipient_vat_number: string | null;
          recipient_zip: string | null;
          status: Database['public']['Enums']['invoice_status'] | null;
          subtotal: number | null;
          tax_amount: number | null;
          total: number | null;
          updated_at: string | null;
          user_id: string;
          xml_url: string | null;
        };
        Insert: {
          amount_paid?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          currency?: string | null;
          due_date?: string | null;
          id?: string;
          internal_notes?: string | null;
          invoice_date?: string | null;
          invoice_number?: string | null;
          invoice_type?: string | null;
          notes?: string | null;
          pdf_url?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          recipient_address?: string | null;
          recipient_city?: string | null;
          recipient_country?: string | null;
          recipient_name?: string | null;
          recipient_pec?: string | null;
          recipient_province?: string | null;
          recipient_sdi_code?: string | null;
          recipient_vat_number?: string | null;
          recipient_zip?: string | null;
          status?: Database['public']['Enums']['invoice_status'] | null;
          subtotal?: number | null;
          tax_amount?: number | null;
          total?: number | null;
          updated_at?: string | null;
          user_id: string;
          xml_url?: string | null;
        };
        Update: {
          amount_paid?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          currency?: string | null;
          due_date?: string | null;
          id?: string;
          internal_notes?: string | null;
          invoice_date?: string | null;
          invoice_number?: string | null;
          invoice_type?: string | null;
          notes?: string | null;
          pdf_url?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          recipient_address?: string | null;
          recipient_city?: string | null;
          recipient_country?: string | null;
          recipient_name?: string | null;
          recipient_pec?: string | null;
          recipient_province?: string | null;
          recipient_sdi_code?: string | null;
          recipient_vat_number?: string | null;
          recipient_zip?: string | null;
          status?: Database['public']['Enums']['invoice_status'] | null;
          subtotal?: number | null;
          tax_amount?: number | null;
          total?: number | null;
          updated_at?: string | null;
          user_id?: string;
          xml_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'invoices_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'invoices_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      killer_features: {
        Row: {
          category: string | null;
          code: string;
          created_at: string | null;
          description: string | null;
          display_order: number | null;
          icon: string | null;
          id: string;
          is_available: boolean | null;
          is_free: boolean | null;
          metadata: Json | null;
          name: string;
          price_monthly_cents: number | null;
          price_yearly_cents: number | null;
          updated_at: string | null;
        };
        Insert: {
          category?: string | null;
          code: string;
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          icon?: string | null;
          id?: string;
          is_available?: boolean | null;
          is_free?: boolean | null;
          metadata?: Json | null;
          name: string;
          price_monthly_cents?: number | null;
          price_yearly_cents?: number | null;
          updated_at?: string | null;
        };
        Update: {
          category?: string | null;
          code?: string;
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          icon?: string | null;
          id?: string;
          is_available?: boolean | null;
          is_free?: boolean | null;
          metadata?: Json | null;
          name?: string;
          price_monthly_cents?: number | null;
          price_yearly_cents?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          assigned_to: string | null;
          company_name: string;
          contact_name: string | null;
          created_at: string | null;
          email: string | null;
          estimated_value: number | null;
          id: string;
          last_contact_at: string | null;
          notes: string | null;
          phone: string | null;
          source: string | null;
          status: Database['public']['Enums']['lead_status'] | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          company_name: string;
          contact_name?: string | null;
          created_at?: string | null;
          email?: string | null;
          estimated_value?: number | null;
          id?: string;
          last_contact_at?: string | null;
          notes?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: Database['public']['Enums']['lead_status'] | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          company_name?: string;
          contact_name?: string | null;
          created_at?: string | null;
          email?: string | null;
          estimated_value?: number | null;
          id?: string;
          last_contact_at?: string | null;
          notes?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: Database['public']['Enums']['lead_status'] | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      ocr_processing_log: {
        Row: {
          consent_given: boolean;
          consent_timestamp: string | null;
          created_at: string;
          deleted_at: string | null;
          error_code: string | null;
          error_message: string | null;
          expires_at: string;
          extracted_fields: Json | null;
          id: string;
          image_format: string | null;
          image_hash: string | null;
          image_size_bytes: number | null;
          ip_address: string | null;
          processing_status: string;
          provider: string;
          soft_deleted: boolean;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          consent_given?: boolean;
          consent_timestamp?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          expires_at?: string;
          extracted_fields?: Json | null;
          id?: string;
          image_format?: string | null;
          image_hash?: string | null;
          image_size_bytes?: number | null;
          ip_address?: string | null;
          processing_status: string;
          provider: string;
          soft_deleted?: boolean;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          consent_given?: boolean;
          consent_timestamp?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          expires_at?: string;
          extracted_fields?: Json | null;
          id?: string;
          image_format?: string | null;
          image_hash?: string | null;
          image_size_bytes?: number | null;
          ip_address?: string | null;
          processing_status?: string;
          provider?: string;
          soft_deleted?: boolean;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_user';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'fk_user';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ocr_processing_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'ocr_processing_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      parent_fee_history: {
        Row: {
          changed_at: string | null;
          changed_by: string;
          child_id: string;
          id: string;
          new_parent_fee: number | null;
          notes: string | null;
          old_parent_fee: number | null;
          parent_id: string;
        };
        Insert: {
          changed_at?: string | null;
          changed_by: string;
          child_id: string;
          id?: string;
          new_parent_fee?: number | null;
          notes?: string | null;
          old_parent_fee?: number | null;
          parent_id: string;
        };
        Update: {
          changed_at?: string | null;
          changed_by?: string;
          child_id?: string;
          id?: string;
          new_parent_fee?: number | null;
          notes?: string | null;
          old_parent_fee?: number | null;
          parent_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parent_fee_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'parent_fee_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parent_fee_history_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'parent_fee_history_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parent_fee_history_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'parent_fee_history_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_transactions: {
        Row: {
          amount_credit: number;
          amount_fee: number;
          amount_total: number;
          amount_net: number | null;
          created_at: string | null;
          id: string;
          metadata: Json | null;
          provider: string | null;
          provider_tx_id: string | null;
          status: string | null;
          updated_at: string | null;
          user_id: string;
          vat_mode: string | null;
          vat_rate: number | null;
          vat_amount: number | null;
        };
        Insert: {
          amount_credit: number;
          amount_fee: number;
          amount_total: number;
          amount_net?: number | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          provider?: string | null;
          provider_tx_id?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id: string;
          vat_mode?: string | null;
          vat_rate?: number | null;
          vat_amount?: number | null;
        };
        Update: {
          amount_credit?: number;
          amount_fee?: number;
          amount_total?: number;
          amount_net?: number | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          provider?: string | null;
          provider_tx_id?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string;
          vat_mode?: string | null;
          vat_rate?: number | null;
          vat_amount?: number | null;
        };
        Relationships: [];
      };
      platform_fee_history: {
        Row: {
          changed_at: string;
          changed_by: string;
          id: string;
          new_fee: number;
          notes: string | null;
          old_fee: number | null;
          user_id: string;
        };
        Insert: {
          changed_at?: string;
          changed_by: string;
          id?: string;
          new_fee: number;
          notes?: string | null;
          old_fee?: number | null;
          user_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string;
          id?: string;
          new_fee?: number;
          notes?: string | null;
          old_fee?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_fee_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'platform_fee_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_fee_history_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'platform_fee_history_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_provider_costs: {
        Row: {
          api_source: string;
          billed_amount: number;
          billed_user_id: string;
          cost_source: string;
          courier_code: string;
          created_at: string | null;
          id: string;
          master_price_list_id: string | null;
          metadata: Json | null;
          platform_margin: number | null;
          platform_margin_percent: number | null;
          price_list_id: string | null;
          provider_cost: number;
          provider_invoice_amount: number | null;
          provider_invoice_date: string | null;
          provider_invoice_id: string | null;
          reconciled_at: string | null;
          reconciled_by: string | null;
          reconciliation_notes: string | null;
          reconciliation_status: string;
          service_type: string | null;
          shipment_id: string;
          shipment_tracking_number: string;
          updated_at: string | null;
        };
        Insert: {
          api_source: string;
          billed_amount: number;
          billed_user_id: string;
          cost_source?: string;
          courier_code: string;
          created_at?: string | null;
          id?: string;
          master_price_list_id?: string | null;
          metadata?: Json | null;
          platform_margin?: number | null;
          platform_margin_percent?: number | null;
          price_list_id?: string | null;
          provider_cost: number;
          provider_invoice_amount?: number | null;
          provider_invoice_date?: string | null;
          provider_invoice_id?: string | null;
          reconciled_at?: string | null;
          reconciled_by?: string | null;
          reconciliation_notes?: string | null;
          reconciliation_status?: string;
          service_type?: string | null;
          shipment_id: string;
          shipment_tracking_number: string;
          updated_at?: string | null;
        };
        Update: {
          api_source?: string;
          billed_amount?: number;
          billed_user_id?: string;
          cost_source?: string;
          courier_code?: string;
          created_at?: string | null;
          id?: string;
          master_price_list_id?: string | null;
          metadata?: Json | null;
          platform_margin?: number | null;
          platform_margin_percent?: number | null;
          price_list_id?: string | null;
          provider_cost?: number;
          provider_invoice_amount?: number | null;
          provider_invoice_date?: string | null;
          provider_invoice_id?: string | null;
          reconciled_at?: string | null;
          reconciled_by?: string | null;
          reconciliation_notes?: string | null;
          reconciliation_status?: string;
          service_type?: string | null;
          shipment_id?: string;
          shipment_tracking_number?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_provider_costs_billed_user_id_fkey';
            columns: ['billed_user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_billed_user_id_fkey';
            columns: ['billed_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_master_price_list_id_fkey';
            columns: ['master_price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_master_price_list_id_fkey';
            columns: ['master_price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_master_price_list_id_fkey';
            columns: ['master_price_list_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_reconciled_by_fkey';
            columns: ['reconciled_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_reconciled_by_fkey';
            columns: ['reconciled_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: true;
            referencedRelation: 'anne_all_shipments_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: true;
            referencedRelation: 'shipments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: true;
            referencedRelation: 'shipments_active';
            referencedColumns: ['id'];
          },
        ];
      };
      price_list_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string;
          created_at: string | null;
          id: string;
          metadata: Json | null;
          notes: string | null;
          price_list_id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by: string;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          price_list_id: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          price_list_id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'price_list_assignments_assigned_by_fkey';
            columns: ['assigned_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'price_list_assignments_assigned_by_fkey';
            columns: ['assigned_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'price_list_assignments_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'price_list_assignments_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'price_list_assignments_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
          {
            foreignKeyName: 'price_list_assignments_revoked_by_fkey';
            columns: ['revoked_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'price_list_assignments_revoked_by_fkey';
            columns: ['revoked_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'price_list_assignments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'price_list_assignments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      price_list_entries: {
        Row: {
          base_price: number;
          cash_on_delivery_surcharge: number | null;
          created_at: string | null;
          estimated_delivery_days_max: number | null;
          estimated_delivery_days_min: number | null;
          fuel_surcharge_percent: number | null;
          id: string;
          insurance_rate_percent: number | null;
          island_surcharge: number | null;
          max_height: number | null;
          max_length: number | null;
          max_width: number | null;
          price_list_id: string | null;
          province_code: string | null;
          region: string | null;
          service_type: Database['public']['Enums']['courier_service_type'] | null;
          size_label: string | null;
          weight_from: number;
          weight_to: number;
          zip_code_from: string | null;
          zip_code_to: string | null;
          zone_code: string | null;
          ztl_surcharge: number | null;
        };
        Insert: {
          base_price: number;
          cash_on_delivery_surcharge?: number | null;
          created_at?: string | null;
          estimated_delivery_days_max?: number | null;
          estimated_delivery_days_min?: number | null;
          fuel_surcharge_percent?: number | null;
          id?: string;
          insurance_rate_percent?: number | null;
          island_surcharge?: number | null;
          max_height?: number | null;
          max_length?: number | null;
          max_width?: number | null;
          price_list_id?: string | null;
          province_code?: string | null;
          region?: string | null;
          service_type?: Database['public']['Enums']['courier_service_type'] | null;
          size_label?: string | null;
          weight_from: number;
          weight_to: number;
          zip_code_from?: string | null;
          zip_code_to?: string | null;
          zone_code?: string | null;
          ztl_surcharge?: number | null;
        };
        Update: {
          base_price?: number;
          cash_on_delivery_surcharge?: number | null;
          created_at?: string | null;
          estimated_delivery_days_max?: number | null;
          estimated_delivery_days_min?: number | null;
          fuel_surcharge_percent?: number | null;
          id?: string;
          insurance_rate_percent?: number | null;
          island_surcharge?: number | null;
          max_height?: number | null;
          max_length?: number | null;
          max_width?: number | null;
          price_list_id?: string | null;
          province_code?: string | null;
          region?: string | null;
          service_type?: Database['public']['Enums']['courier_service_type'] | null;
          size_label?: string | null;
          weight_from?: number;
          weight_to?: number;
          zip_code_from?: string | null;
          zip_code_to?: string | null;
          zone_code?: string | null;
          ztl_surcharge?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'price_list_entries_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'price_list_entries_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'price_list_entries_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
        ];
      };
      price_lists: {
        Row: {
          assigned_to_user_id: string | null;
          courier_id: string | null;
          created_at: string | null;
          created_by: string | null;
          default_margin_fixed: number | null;
          default_margin_percent: number | null;
          description: string | null;
          id: string;
          is_global: boolean | null;
          last_used_at: string | null;
          list_type: string | null;
          master_list_id: string | null;
          metadata: Json | null;
          name: string;
          notes: string | null;
          parent_version_id: string | null;
          priority: string | null;
          rules: Json | null;
          source_file_name: string | null;
          source_file_url: string | null;
          source_metadata: Json | null;
          source_type: string | null;
          status: string | null;
          updated_at: string | null;
          usage_count: number | null;
          valid_from: string | null;
          valid_until: string | null;
          vat_mode: string | null;
          vat_rate: number | null;
          version: string;
        };
        Insert: {
          assigned_to_user_id?: string | null;
          courier_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          default_margin_fixed?: number | null;
          default_margin_percent?: number | null;
          description?: string | null;
          id?: string;
          is_global?: boolean | null;
          last_used_at?: string | null;
          list_type?: string | null;
          master_list_id?: string | null;
          metadata?: Json | null;
          name: string;
          notes?: string | null;
          parent_version_id?: string | null;
          priority?: string | null;
          rules?: Json | null;
          source_file_name?: string | null;
          source_file_url?: string | null;
          source_metadata?: Json | null;
          source_type?: string | null;
          status?: string | null;
          updated_at?: string | null;
          usage_count?: number | null;
          valid_from?: string | null;
          valid_until?: string | null;
          vat_mode?: string | null;
          vat_rate?: number | null;
          version: string;
        };
        Update: {
          assigned_to_user_id?: string | null;
          courier_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          default_margin_fixed?: number | null;
          default_margin_percent?: number | null;
          description?: string | null;
          id?: string;
          is_global?: boolean | null;
          last_used_at?: string | null;
          list_type?: string | null;
          master_list_id?: string | null;
          metadata?: Json | null;
          name?: string;
          notes?: string | null;
          parent_version_id?: string | null;
          priority?: string | null;
          rules?: Json | null;
          source_file_name?: string | null;
          source_file_url?: string | null;
          source_metadata?: Json | null;
          source_type?: string | null;
          status?: string | null;
          updated_at?: string | null;
          usage_count?: number | null;
          valid_from?: string | null;
          valid_until?: string | null;
          vat_mode?: string | null;
          vat_rate?: number | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_price_lists_assigned_user';
            columns: ['assigned_to_user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'fk_price_lists_assigned_user';
            columns: ['assigned_to_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_price_lists_master';
            columns: ['master_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'fk_price_lists_master';
            columns: ['master_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_price_lists_master';
            columns: ['master_list_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
          {
            foreignKeyName: 'fk_price_lists_parent_version';
            columns: ['parent_version_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'fk_price_lists_parent_version';
            columns: ['parent_version_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_price_lists_parent_version';
            columns: ['parent_version_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
        ];
      };
      reseller_pricing_policies: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          enforce_limits: boolean;
          id: string;
          min_markup_percent: number;
          notes: string | null;
          reseller_id: string;
          revoked_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          enforce_limits?: boolean;
          id?: string;
          min_markup_percent?: number;
          notes?: string | null;
          reseller_id: string;
          revoked_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          enforce_limits?: boolean;
          id?: string;
          min_markup_percent?: number;
          notes?: string | null;
          reseller_id?: string;
          revoked_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reseller_pricing_policies_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'reseller_pricing_policies_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reseller_pricing_policies_reseller_id_fkey';
            columns: ['reseller_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'reseller_pricing_policies_reseller_id_fkey';
            columns: ['reseller_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      reseller_team_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string | null;
          created_by: string | null;
          expires_at: string;
          id: string;
          invite_token: string;
          invited_email: string;
          invited_role: string;
          permissions: Json | null;
          reseller_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          invite_token: string;
          invited_email: string;
          invited_role: string;
          permissions?: Json | null;
          reseller_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          invite_token?: string;
          invited_email?: string;
          invited_role?: string;
          permissions?: Json | null;
          reseller_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reseller_team_invites_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'reseller_team_invites_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reseller_team_invites_reseller_id_fkey';
            columns: ['reseller_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'reseller_team_invites_reseller_id_fkey';
            columns: ['reseller_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      role_permissions: {
        Row: {
          can_manage: boolean | null;
          created_at: string | null;
          feature_code: string;
          has_access: boolean | null;
          id: string;
          role: Database['public']['Enums']['user_role'];
          updated_at: string | null;
        };
        Insert: {
          can_manage?: boolean | null;
          created_at?: string | null;
          feature_code: string;
          has_access?: boolean | null;
          id?: string;
          role: Database['public']['Enums']['user_role'];
          updated_at?: string | null;
        };
        Update: {
          can_manage?: boolean | null;
          created_at?: string | null;
          feature_code?: string;
          has_access?: boolean | null;
          id?: string;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      security_audit_log: {
        Row: {
          created_at: string | null;
          event_type: string;
          id: string;
          ip_address: unknown;
          message: string | null;
          metadata: Json | null;
          request_method: string | null;
          request_path: string | null;
          resource_id: string | null;
          resource_type: string | null;
          severity: string;
          user_agent: string | null;
          user_email: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          event_type: string;
          id?: string;
          ip_address?: unknown;
          message?: string | null;
          metadata?: Json | null;
          request_method?: string | null;
          request_path?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
          severity: string;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          event_type?: string;
          id?: string;
          ip_address?: unknown;
          message?: string | null;
          metadata?: Json | null;
          request_method?: string | null;
          request_path?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
          severity?: string;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'security_audit_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'security_audit_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      security_events: {
        Row: {
          action: string | null;
          actor_id: string | null;
          created_at: string;
          details: Json | null;
          event_type: string;
          id: string;
          ip_address: string | null;
          resource_id: string | null;
          resource_type: string | null;
          severity: string;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action?: string | null;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          event_type: string;
          id?: string;
          ip_address?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
          severity?: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string | null;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          event_type?: string;
          id?: string;
          ip_address?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
          severity?: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'security_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'security_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'security_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'security_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      shipments: {
        Row: {
          api_source: string | null;
          applied_price_rule_id: string | null;
          base_price: number | null;
          carrier: string | null;
          cash_on_delivery: boolean | null;
          cash_on_delivery_amount: number | null;
          cod_status: Database['public']['Enums']['cod_status_type'] | null;
          content: string | null;
          contrassegno_amount: number | null;
          courier_cost: number | null;
          courier_id: string | null;
          created_at: string | null;
          created_by_user_email: string | null;
          created_via_ocr: boolean | null;
          currency: string | null;
          declared_value: number | null;
          deleted: boolean | null;
          deleted_at: string | null;
          deleted_by_user_email: string | null;
          deleted_by_user_id: string | null;
          delivered_at: string | null;
          ecommerce_order_id: string | null;
          ecommerce_order_number: string | null;
          ecommerce_platform: string | null;
          external_tracking_number: string | null;
          final_price: number | null;
          gps_location: string | null;
          height: number | null;
          id: string;
          idempotency_key: string | null;
          import_platform: string | null;
          import_source: string | null;
          imported: boolean | null;
          insurance: boolean | null;
          internal_notes: string | null;
          is_return: boolean | null;
          label_data: string | null;
          label_zpl: string | null;
          ldv: string | null;
          length: number | null;
          margin: number | null;
          margin_percent: number | null;
          metadata: Json | null;
          notes: string | null;
          ocr_confidence_score: number | null;
          order_reference: string | null;
          original_shipment_id: string | null;
          packages: number | null;
          packages_count: number | null;
          pickup_time: string | null;
          price_list_id: string | null;
          price_list_used_id: string | null;
          recipient_address: string | null;
          recipient_address_number: string | null;
          recipient_city: string | null;
          recipient_country: string | null;
          recipient_email: string | null;
          recipient_name: string;
          recipient_notes: string | null;
          recipient_phone: string | null;
          recipient_postal_code: string | null;
          recipient_province: string | null;
          recipient_reference: string | null;
          recipient_type: Database['public']['Enums']['recipient_type'] | null;
          recipient_zip: string | null;
          return_reason: string | null;
          return_status: string | null;
          sender_address: string | null;
          sender_city: string | null;
          sender_country: string | null;
          sender_email: string | null;
          sender_name: string;
          sender_phone: string | null;
          sender_province: string | null;
          sender_reference: string | null;
          sender_zip: string | null;
          service_type: Database['public']['Enums']['courier_service_type'] | null;
          shipment_id_external: string | null;
          shipped_at: string | null;
          status: string | null;
          surcharges: number | null;
          total_cost: number | null;
          total_price: number | null;
          tracking_last_event: string | null;
          tracking_last_update: string | null;
          tracking_number: string;
          tracking_status: string | null;
          updated_at: string | null;
          user_id: string | null;
          vat_mode: string | null;
          vat_rate: number | null;
          verified: boolean | null;
          volumetric_weight: number | null;
          weight: number;
          width: number | null;
        };
        Insert: {
          api_source?: string | null;
          applied_price_rule_id?: string | null;
          base_price?: number | null;
          carrier?: string | null;
          cash_on_delivery?: boolean | null;
          cash_on_delivery_amount?: number | null;
          cod_status?: Database['public']['Enums']['cod_status_type'] | null;
          content?: string | null;
          contrassegno_amount?: number | null;
          courier_cost?: number | null;
          courier_id?: string | null;
          created_at?: string | null;
          created_by_user_email?: string | null;
          created_via_ocr?: boolean | null;
          currency?: string | null;
          declared_value?: number | null;
          deleted?: boolean | null;
          deleted_at?: string | null;
          deleted_by_user_email?: string | null;
          deleted_by_user_id?: string | null;
          delivered_at?: string | null;
          ecommerce_order_id?: string | null;
          ecommerce_order_number?: string | null;
          ecommerce_platform?: string | null;
          external_tracking_number?: string | null;
          final_price?: number | null;
          gps_location?: string | null;
          height?: number | null;
          id?: string;
          idempotency_key?: string | null;
          import_platform?: string | null;
          import_source?: string | null;
          imported?: boolean | null;
          insurance?: boolean | null;
          internal_notes?: string | null;
          is_return?: boolean | null;
          label_data?: string | null;
          label_zpl?: string | null;
          ldv?: string | null;
          length?: number | null;
          margin?: number | null;
          margin_percent?: number | null;
          metadata?: Json | null;
          notes?: string | null;
          ocr_confidence_score?: number | null;
          order_reference?: string | null;
          original_shipment_id?: string | null;
          packages?: number | null;
          packages_count?: number | null;
          pickup_time?: string | null;
          price_list_id?: string | null;
          price_list_used_id?: string | null;
          recipient_address?: string | null;
          recipient_address_number?: string | null;
          recipient_city?: string | null;
          recipient_country?: string | null;
          recipient_email?: string | null;
          recipient_name: string;
          recipient_notes?: string | null;
          recipient_phone?: string | null;
          recipient_postal_code?: string | null;
          recipient_province?: string | null;
          recipient_reference?: string | null;
          recipient_type?: Database['public']['Enums']['recipient_type'] | null;
          recipient_zip?: string | null;
          return_reason?: string | null;
          return_status?: string | null;
          sender_address?: string | null;
          sender_city?: string | null;
          sender_country?: string | null;
          sender_email?: string | null;
          sender_name: string;
          sender_phone?: string | null;
          sender_province?: string | null;
          sender_reference?: string | null;
          sender_zip?: string | null;
          service_type?: Database['public']['Enums']['courier_service_type'] | null;
          shipment_id_external?: string | null;
          shipped_at?: string | null;
          status?: string | null;
          surcharges?: number | null;
          total_cost?: number | null;
          total_price?: number | null;
          tracking_last_event?: string | null;
          tracking_last_update?: string | null;
          tracking_number: string;
          tracking_status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          vat_mode?: string | null;
          vat_rate?: number | null;
          verified?: boolean | null;
          volumetric_weight?: number | null;
          weight: number;
          width?: number | null;
        };
        Update: {
          api_source?: string | null;
          applied_price_rule_id?: string | null;
          base_price?: number | null;
          carrier?: string | null;
          cash_on_delivery?: boolean | null;
          cash_on_delivery_amount?: number | null;
          cod_status?: Database['public']['Enums']['cod_status_type'] | null;
          content?: string | null;
          contrassegno_amount?: number | null;
          courier_cost?: number | null;
          courier_id?: string | null;
          created_at?: string | null;
          created_by_user_email?: string | null;
          created_via_ocr?: boolean | null;
          currency?: string | null;
          declared_value?: number | null;
          deleted?: boolean | null;
          deleted_at?: string | null;
          deleted_by_user_email?: string | null;
          deleted_by_user_id?: string | null;
          delivered_at?: string | null;
          ecommerce_order_id?: string | null;
          ecommerce_order_number?: string | null;
          ecommerce_platform?: string | null;
          external_tracking_number?: string | null;
          final_price?: number | null;
          gps_location?: string | null;
          height?: number | null;
          id?: string;
          idempotency_key?: string | null;
          import_platform?: string | null;
          import_source?: string | null;
          imported?: boolean | null;
          insurance?: boolean | null;
          internal_notes?: string | null;
          is_return?: boolean | null;
          label_data?: string | null;
          label_zpl?: string | null;
          ldv?: string | null;
          length?: number | null;
          margin?: number | null;
          margin_percent?: number | null;
          metadata?: Json | null;
          notes?: string | null;
          ocr_confidence_score?: number | null;
          order_reference?: string | null;
          original_shipment_id?: string | null;
          packages?: number | null;
          packages_count?: number | null;
          pickup_time?: string | null;
          price_list_id?: string | null;
          price_list_used_id?: string | null;
          recipient_address?: string | null;
          recipient_address_number?: string | null;
          recipient_city?: string | null;
          recipient_country?: string | null;
          recipient_email?: string | null;
          recipient_name?: string;
          recipient_notes?: string | null;
          recipient_phone?: string | null;
          recipient_postal_code?: string | null;
          recipient_province?: string | null;
          recipient_reference?: string | null;
          recipient_type?: Database['public']['Enums']['recipient_type'] | null;
          recipient_zip?: string | null;
          return_reason?: string | null;
          return_status?: string | null;
          sender_address?: string | null;
          sender_city?: string | null;
          sender_country?: string | null;
          sender_email?: string | null;
          sender_name?: string;
          sender_phone?: string | null;
          sender_province?: string | null;
          sender_reference?: string | null;
          sender_zip?: string | null;
          service_type?: Database['public']['Enums']['courier_service_type'] | null;
          shipment_id_external?: string | null;
          shipped_at?: string | null;
          status?: string | null;
          surcharges?: number | null;
          total_cost?: number | null;
          total_price?: number | null;
          tracking_last_event?: string | null;
          tracking_last_update?: string | null;
          tracking_number?: string;
          tracking_status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          vat_mode?: string | null;
          vat_rate?: number | null;
          verified?: boolean | null;
          volumetric_weight?: number | null;
          weight?: number;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_shipments_price_list';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'fk_shipments_price_list';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_shipments_price_list';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
          {
            foreignKeyName: 'shipments_deleted_by_user_id_fkey';
            columns: ['deleted_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'shipments_deleted_by_user_id_fkey';
            columns: ['deleted_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shipments_original_shipment_id_fkey';
            columns: ['original_shipment_id'];
            isOneToOne: false;
            referencedRelation: 'anne_all_shipments_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shipments_original_shipment_id_fkey';
            columns: ['original_shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shipments_original_shipment_id_fkey';
            columns: ['original_shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments_active';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shipments_price_list_used_id_fkey';
            columns: ['price_list_used_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'shipments_price_list_used_id_fkey';
            columns: ['price_list_used_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shipments_price_list_used_id_fkey';
            columns: ['price_list_used_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
        ];
      };
      supplier_price_list_config: {
        Row: {
          accessory_services_config: Json | null;
          carrier_code: string;
          cod_config: Json | null;
          contract_code: string | null;
          courier_config_id: string | null;
          created_at: string | null;
          created_by: string | null;
          extra_config: Json | null;
          id: string;
          insurance_config: Json | null;
          notes: string | null;
          pickup_config: Json | null;
          price_list_id: string;
          storage_config: Json | null;
          updated_at: string | null;
          updated_by: string | null;
          volumetric_density_factor: number | null;
        };
        Insert: {
          accessory_services_config?: Json | null;
          carrier_code: string;
          cod_config?: Json | null;
          contract_code?: string | null;
          courier_config_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          extra_config?: Json | null;
          id?: string;
          insurance_config?: Json | null;
          notes?: string | null;
          pickup_config?: Json | null;
          price_list_id: string;
          storage_config?: Json | null;
          updated_at?: string | null;
          updated_by?: string | null;
          volumetric_density_factor?: number | null;
        };
        Update: {
          accessory_services_config?: Json | null;
          carrier_code?: string;
          cod_config?: Json | null;
          contract_code?: string | null;
          courier_config_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          extra_config?: Json | null;
          id?: string;
          insurance_config?: Json | null;
          notes?: string | null;
          pickup_config?: Json | null;
          price_list_id?: string;
          storage_config?: Json | null;
          updated_at?: string | null;
          updated_by?: string | null;
          volumetric_density_factor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'supplier_price_list_config_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'supplier_price_list_config_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'supplier_price_list_config_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: true;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'supplier_price_list_config_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: true;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'supplier_price_list_config_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: true;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
          {
            foreignKeyName: 'supplier_price_list_config_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'supplier_price_list_config_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      system_settings: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          setting_key: string;
          setting_value: Json;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          setting_key: string;
          setting_value: Json;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          setting_key?: string;
          setting_value?: Json;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      top_up_requests: {
        Row: {
          admin_notes: string | null;
          ai_confidence: number | null;
          amount: number | null;
          approved_amount: number | null;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string | null;
          extracted_data: Json | null;
          file_hash: string | null;
          file_url: string;
          id: string;
          status: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          admin_notes?: string | null;
          ai_confidence?: number | null;
          amount?: number | null;
          approved_amount?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string | null;
          extracted_data?: Json | null;
          file_hash?: string | null;
          file_url: string;
          id?: string;
          status?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          admin_notes?: string | null;
          ai_confidence?: number | null;
          amount?: number | null;
          approved_amount?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string | null;
          extracted_data?: Json | null;
          file_hash?: string | null;
          file_url?: string;
          id?: string;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      tracking_events: {
        Row: {
          carrier: string | null;
          created_at: string | null;
          description: string | null;
          event_date: string;
          fetched_at: string | null;
          id: string;
          location: string | null;
          provider: string | null;
          raw_data: Json | null;
          shipment_id: string;
          status: string;
          status_normalized: string | null;
          tracking_number: string;
        };
        Insert: {
          carrier?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_date: string;
          fetched_at?: string | null;
          id?: string;
          location?: string | null;
          provider?: string | null;
          raw_data?: Json | null;
          shipment_id: string;
          status: string;
          status_normalized?: string | null;
          tracking_number: string;
        };
        Update: {
          carrier?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_date?: string;
          fetched_at?: string | null;
          id?: string;
          location?: string | null;
          provider?: string | null;
          raw_data?: Json | null;
          shipment_id?: string;
          status?: string;
          status_normalized?: string | null;
          tracking_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tracking_events_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'anne_all_shipments_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tracking_events_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tracking_events_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: false;
            referencedRelation: 'shipments_active';
            referencedColumns: ['id'];
          },
        ];
      };
      user_features: {
        Row: {
          activated_at: string | null;
          activation_type: string | null;
          created_at: string | null;
          expires_at: string | null;
          feature_id: string;
          id: string;
          is_active: boolean | null;
          metadata: Json | null;
          subscription_id: string | null;
          updated_at: string | null;
          user_email: string;
        };
        Insert: {
          activated_at?: string | null;
          activation_type?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
          feature_id: string;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          subscription_id?: string | null;
          updated_at?: string | null;
          user_email: string;
        };
        Update: {
          activated_at?: string | null;
          activation_type?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
          feature_id?: string;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          subscription_id?: string | null;
          updated_at?: string | null;
          user_email?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_features_feature_id_fkey';
            columns: ['feature_id'];
            isOneToOne: false;
            referencedRelation: 'killer_features';
            referencedColumns: ['id'];
          },
        ];
      };
      user_integrations: {
        Row: {
          created_at: string | null;
          credentials: Json;
          error_log: string | null;
          id: string;
          is_active: boolean | null;
          last_sync: string | null;
          provider: string;
          settings: Json | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          credentials: Json;
          error_log?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_sync?: string | null;
          provider: string;
          settings?: Json | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          credentials?: Json;
          error_log?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_sync?: string | null;
          provider?: string;
          settings?: Json | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          created_at: string | null;
          email: string;
          id: string;
          name: string | null;
          nextauth_user_id: string | null;
          provider: string | null;
          provider_id: string | null;
          supabase_user_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
          name?: string | null;
          nextauth_user_id?: string | null;
          provider?: string | null;
          provider_id?: string | null;
          supabase_user_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
          name?: string | null;
          nextauth_user_id?: string | null;
          provider?: string | null;
          provider_id?: string | null;
          supabase_user_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: {
          account_type: Database['public']['Enums']['account_type'] | null;
          admin_level: number | null;
          assigned_config_id: string | null;
          assigned_price_list_id: string | null;
          billing_mode: string | null;
          created_at: string | null;
          dati_cliente: Json | null;
          default_sender: Json | null;
          email: string;
          fee_applied_by_parent_id: string | null;
          full_name: string | null;
          id: string;
          image: string | null;
          integrazioni: Json | null;
          is_reseller: boolean | null;
          last_login_at: string | null;
          name: string;
          ocr_vision_consent_given_at: string | null;
          ocr_vision_consent_ip: string | null;
          ocr_vision_consent_user_agent: string | null;
          parent_admin_id: string | null;
          parent_id: string | null;
          parent_imposed_fee: number | null;
          parent_reseller_id: string | null;
          password: string | null;
          platform_fee_notes: string | null;
          platform_fee_override: number | null;
          provider: string | null;
          provider_id: string | null;
          reseller_role: string | null;
          reseller_tier: Database['public']['Enums']['reseller_tier'] | null;
          role: string;
          team_invited_at: string | null;
          team_joined_at: string | null;
          team_permissions: Json | null;
          team_status: string | null;
          tenant_id: string | null;
          updated_at: string | null;
          wallet_balance: number | null;
        };
        Insert: {
          account_type?: Database['public']['Enums']['account_type'] | null;
          admin_level?: number | null;
          assigned_config_id?: string | null;
          assigned_price_list_id?: string | null;
          billing_mode?: string | null;
          created_at?: string | null;
          dati_cliente?: Json | null;
          default_sender?: Json | null;
          email: string;
          fee_applied_by_parent_id?: string | null;
          full_name?: string | null;
          id?: string;
          image?: string | null;
          integrazioni?: Json | null;
          is_reseller?: boolean | null;
          last_login_at?: string | null;
          name: string;
          ocr_vision_consent_given_at?: string | null;
          ocr_vision_consent_ip?: string | null;
          ocr_vision_consent_user_agent?: string | null;
          parent_admin_id?: string | null;
          parent_id?: string | null;
          parent_imposed_fee?: number | null;
          parent_reseller_id?: string | null;
          password?: string | null;
          platform_fee_notes?: string | null;
          platform_fee_override?: number | null;
          provider?: string | null;
          provider_id?: string | null;
          reseller_role?: string | null;
          reseller_tier?: Database['public']['Enums']['reseller_tier'] | null;
          role?: string;
          team_invited_at?: string | null;
          team_joined_at?: string | null;
          team_permissions?: Json | null;
          team_status?: string | null;
          tenant_id?: string | null;
          updated_at?: string | null;
          wallet_balance?: number | null;
        };
        Update: {
          account_type?: Database['public']['Enums']['account_type'] | null;
          admin_level?: number | null;
          assigned_config_id?: string | null;
          assigned_price_list_id?: string | null;
          billing_mode?: string | null;
          created_at?: string | null;
          dati_cliente?: Json | null;
          default_sender?: Json | null;
          email?: string;
          fee_applied_by_parent_id?: string | null;
          full_name?: string | null;
          id?: string;
          image?: string | null;
          integrazioni?: Json | null;
          is_reseller?: boolean | null;
          last_login_at?: string | null;
          name?: string;
          ocr_vision_consent_given_at?: string | null;
          ocr_vision_consent_ip?: string | null;
          ocr_vision_consent_user_agent?: string | null;
          parent_admin_id?: string | null;
          parent_id?: string | null;
          parent_imposed_fee?: number | null;
          parent_reseller_id?: string | null;
          password?: string | null;
          platform_fee_notes?: string | null;
          platform_fee_override?: number | null;
          provider?: string | null;
          provider_id?: string | null;
          reseller_role?: string | null;
          reseller_tier?: Database['public']['Enums']['reseller_tier'] | null;
          role?: string;
          team_invited_at?: string | null;
          team_joined_at?: string | null;
          team_permissions?: Json | null;
          team_status?: string | null;
          tenant_id?: string | null;
          updated_at?: string | null;
          wallet_balance?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_users_assigned_price_list';
            columns: ['assigned_price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'fk_users_assigned_price_list';
            columns: ['assigned_price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_users_assigned_price_list';
            columns: ['assigned_price_list_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
          {
            foreignKeyName: 'users_assigned_config_id_fkey';
            columns: ['assigned_config_id'];
            isOneToOne: false;
            referencedRelation: 'courier_configs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'users_fee_applied_by_parent_id_fkey';
            columns: ['fee_applied_by_parent_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'users_fee_applied_by_parent_id_fkey';
            columns: ['fee_applied_by_parent_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'users_parent_admin_id_fkey';
            columns: ['parent_admin_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'users_parent_admin_id_fkey';
            columns: ['parent_admin_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'users_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'users_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'users_parent_reseller_id_fkey';
            columns: ['parent_reseller_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'users_parent_reseller_id_fkey';
            columns: ['parent_reseller_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'users_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'users_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      wallet_transactions: {
        Row: {
          amount: number;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          idempotency_key: string | null;
          reference_id: string | null;
          reference_type: string | null;
          type: string;
          user_id: string;
          vat_mode: string | null;
          vat_rate: number | null;
          vat_amount: number | null;
          gross_amount: number | null;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          idempotency_key?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          type: string;
          user_id: string;
          vat_mode?: string | null;
          vat_rate?: number | null;
          vat_amount?: number | null;
          gross_amount?: number | null;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          idempotency_key?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          type?: string;
          user_id?: string;
          vat_mode?: string | null;
          vat_rate?: number | null;
          vat_amount?: number | null;
          gross_amount?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'wallet_transactions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'wallet_transactions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallet_transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'wallet_transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      admin_monthly_stats: {
        Row: {
          avg_margin: number | null;
          couriers_used: number | null;
          delivered_count: number | null;
          failed_count: number | null;
          in_transit_count: number | null;
          month: string | null;
          pending_count: number | null;
          total_margin: number | null;
          total_revenue: number | null;
          total_shipments: number | null;
          unique_customers: number | null;
        };
        Relationships: [];
      };
      anne_all_shipments_view: {
        Row: {
          base_price: number | null;
          cash_on_delivery: boolean | null;
          cash_on_delivery_amount: number | null;
          content: string | null;
          courier_display_name: string | null;
          courier_id: string | null;
          courier_name: string | null;
          created_at: string | null;
          created_by_user_email: string | null;
          created_via_ocr: boolean | null;
          currency: string | null;
          declared_value: number | null;
          deleted: boolean | null;
          deleted_at: string | null;
          delivered_at: string | null;
          ecommerce_order_id: string | null;
          ecommerce_order_number: string | null;
          ecommerce_platform: string | null;
          external_tracking_number: string | null;
          final_price: number | null;
          gps_location: string | null;
          height: number | null;
          id: string | null;
          import_platform: string | null;
          import_source: string | null;
          imported: boolean | null;
          insurance: boolean | null;
          internal_notes: string | null;
          ldv: string | null;
          length: number | null;
          margin_percent: number | null;
          notes: string | null;
          ocr_confidence_score: number | null;
          owner_account_type: Database['public']['Enums']['account_type'] | null;
          owner_email: string | null;
          owner_name: string | null;
          owner_role: string | null;
          packages_count: number | null;
          pickup_time: string | null;
          recipient_address: string | null;
          recipient_city: string | null;
          recipient_country: string | null;
          recipient_email: string | null;
          recipient_name: string | null;
          recipient_notes: string | null;
          recipient_phone: string | null;
          recipient_province: string | null;
          recipient_type: Database['public']['Enums']['recipient_type'] | null;
          recipient_zip: string | null;
          sender_address: string | null;
          sender_city: string | null;
          sender_country: string | null;
          sender_email: string | null;
          sender_name: string | null;
          sender_phone: string | null;
          sender_province: string | null;
          sender_reference: string | null;
          sender_zip: string | null;
          service_type: Database['public']['Enums']['courier_service_type'] | null;
          shipped_at: string | null;
          source_category: string | null;
          status: string | null;
          surcharges: number | null;
          total_cost: number | null;
          tracking_number: string | null;
          updated_at: string | null;
          user_id: string | null;
          verified: boolean | null;
          volumetric_weight: number | null;
          weight: number | null;
          width: number | null;
        };
        Relationships: [];
      };
      audit_logs_summary: {
        Row: {
          action: string | null;
          event_count: number | null;
          impersonation_events: number | null;
          log_date: string | null;
          resource_type: string | null;
          unique_actors: number | null;
        };
        Relationships: [];
      };
      compensation_queue_stats: {
        Row: {
          avg_retry_count: number | null;
          newest_record: string | null;
          older_than_7_days: number | null;
          oldest_record: string | null;
          status: string | null;
          total_amount: number | null;
          total_count: number | null;
        };
        Relationships: [];
      };
      price_list_usage_stats: {
        Row: {
          import_count: number | null;
          last_activity_at: string | null;
          last_used_at: string | null;
          price_list_id: string | null;
          price_list_name: string | null;
          quote_count: number | null;
          update_count: number | null;
        };
        Relationships: [];
      };
      shipments_active: {
        Row: {
          base_price: number | null;
          cash_on_delivery: boolean | null;
          cash_on_delivery_amount: number | null;
          content: string | null;
          courier_id: string | null;
          created_at: string | null;
          created_by_user_email: string | null;
          currency: string | null;
          declared_value: number | null;
          deleted: boolean | null;
          deleted_at: string | null;
          deleted_by_user_id: string | null;
          delivered_at: string | null;
          ecommerce_order_id: string | null;
          ecommerce_order_number: string | null;
          external_tracking_number: string | null;
          final_price: number | null;
          height: number | null;
          id: string | null;
          import_platform: string | null;
          import_source: string | null;
          imported: boolean | null;
          insurance: boolean | null;
          internal_notes: string | null;
          ldv: string | null;
          length: number | null;
          margin_percent: number | null;
          notes: string | null;
          order_reference: string | null;
          packages_count: number | null;
          recipient_address: string | null;
          recipient_address_number: string | null;
          recipient_city: string | null;
          recipient_country: string | null;
          recipient_email: string | null;
          recipient_name: string | null;
          recipient_notes: string | null;
          recipient_phone: string | null;
          recipient_province: string | null;
          recipient_reference: string | null;
          recipient_type: Database['public']['Enums']['recipient_type'] | null;
          recipient_zip: string | null;
          sender_address: string | null;
          sender_city: string | null;
          sender_country: string | null;
          sender_email: string | null;
          sender_name: string | null;
          sender_phone: string | null;
          sender_province: string | null;
          sender_reference: string | null;
          sender_zip: string | null;
          service_type: Database['public']['Enums']['courier_service_type'] | null;
          shipped_at: string | null;
          status: string | null;
          surcharges: number | null;
          total_cost: number | null;
          tracking_number: string | null;
          updated_at: string | null;
          user_id: string | null;
          verified: boolean | null;
          volumetric_weight: number | null;
          weight: number | null;
          width: number | null;
        };
        Insert: {
          base_price?: number | null;
          cash_on_delivery?: boolean | null;
          cash_on_delivery_amount?: number | null;
          content?: string | null;
          courier_id?: string | null;
          created_at?: string | null;
          created_by_user_email?: string | null;
          currency?: string | null;
          declared_value?: number | null;
          deleted?: boolean | null;
          deleted_at?: string | null;
          deleted_by_user_id?: string | null;
          delivered_at?: string | null;
          ecommerce_order_id?: string | null;
          ecommerce_order_number?: string | null;
          external_tracking_number?: string | null;
          final_price?: number | null;
          height?: number | null;
          id?: string | null;
          import_platform?: string | null;
          import_source?: string | null;
          imported?: boolean | null;
          insurance?: boolean | null;
          internal_notes?: string | null;
          ldv?: string | null;
          length?: number | null;
          margin_percent?: number | null;
          notes?: string | null;
          order_reference?: string | null;
          packages_count?: number | null;
          recipient_address?: string | null;
          recipient_address_number?: string | null;
          recipient_city?: string | null;
          recipient_country?: string | null;
          recipient_email?: string | null;
          recipient_name?: string | null;
          recipient_notes?: string | null;
          recipient_phone?: string | null;
          recipient_province?: string | null;
          recipient_reference?: string | null;
          recipient_type?: Database['public']['Enums']['recipient_type'] | null;
          recipient_zip?: string | null;
          sender_address?: string | null;
          sender_city?: string | null;
          sender_country?: string | null;
          sender_email?: string | null;
          sender_name?: string | null;
          sender_phone?: string | null;
          sender_province?: string | null;
          sender_reference?: string | null;
          sender_zip?: string | null;
          service_type?: Database['public']['Enums']['courier_service_type'] | null;
          shipped_at?: string | null;
          status?: string | null;
          surcharges?: number | null;
          total_cost?: number | null;
          tracking_number?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          verified?: boolean | null;
          volumetric_weight?: number | null;
          weight?: number | null;
          width?: number | null;
        };
        Update: {
          base_price?: number | null;
          cash_on_delivery?: boolean | null;
          cash_on_delivery_amount?: number | null;
          content?: string | null;
          courier_id?: string | null;
          created_at?: string | null;
          created_by_user_email?: string | null;
          currency?: string | null;
          declared_value?: number | null;
          deleted?: boolean | null;
          deleted_at?: string | null;
          deleted_by_user_id?: string | null;
          delivered_at?: string | null;
          ecommerce_order_id?: string | null;
          ecommerce_order_number?: string | null;
          external_tracking_number?: string | null;
          final_price?: number | null;
          height?: number | null;
          id?: string | null;
          import_platform?: string | null;
          import_source?: string | null;
          imported?: boolean | null;
          insurance?: boolean | null;
          internal_notes?: string | null;
          ldv?: string | null;
          length?: number | null;
          margin_percent?: number | null;
          notes?: string | null;
          order_reference?: string | null;
          packages_count?: number | null;
          recipient_address?: string | null;
          recipient_address_number?: string | null;
          recipient_city?: string | null;
          recipient_country?: string | null;
          recipient_email?: string | null;
          recipient_name?: string | null;
          recipient_notes?: string | null;
          recipient_phone?: string | null;
          recipient_province?: string | null;
          recipient_reference?: string | null;
          recipient_type?: Database['public']['Enums']['recipient_type'] | null;
          recipient_zip?: string | null;
          sender_address?: string | null;
          sender_city?: string | null;
          sender_country?: string | null;
          sender_email?: string | null;
          sender_name?: string | null;
          sender_phone?: string | null;
          sender_province?: string | null;
          sender_reference?: string | null;
          sender_zip?: string | null;
          service_type?: Database['public']['Enums']['courier_service_type'] | null;
          shipped_at?: string | null;
          status?: string | null;
          surcharges?: number | null;
          total_cost?: number | null;
          tracking_number?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          verified?: boolean | null;
          volumetric_weight?: number | null;
          weight?: number | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'shipments_deleted_by_user_id_fkey';
            columns: ['deleted_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'shipments_deleted_by_user_id_fkey';
            columns: ['deleted_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      top_customers: {
        Row: {
          active_months: number | null;
          avg_margin_per_shipment: number | null;
          email: string | null;
          first_shipment_date: string | null;
          full_name: string | null;
          last_shipment_date: string | null;
          total_margin: number | null;
          total_shipments: number | null;
          total_spent: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      v_active_assignments: {
        Row: {
          assigned_at: string | null;
          assigned_by: string | null;
          assigner_email: string | null;
          assignment_id: string | null;
          courier_id: string | null;
          list_type: string | null;
          master_list_id: string | null;
          notes: string | null;
          price_list_id: string | null;
          price_list_name: string | null;
          user_account_type: Database['public']['Enums']['account_type'] | null;
          user_email: string | null;
          user_id: string | null;
          user_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_price_lists_master';
            columns: ['master_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'fk_price_lists_master';
            columns: ['master_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_price_lists_master';
            columns: ['master_list_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
          {
            foreignKeyName: 'price_list_assignments_assigned_by_fkey';
            columns: ['assigned_by'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'price_list_assignments_assigned_by_fkey';
            columns: ['assigned_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'price_list_assignments_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_list_usage_stats';
            referencedColumns: ['price_list_id'];
          },
          {
            foreignKeyName: 'price_list_assignments_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'price_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'price_list_assignments_price_list_id_fkey';
            columns: ['price_list_id'];
            isOneToOne: false;
            referencedRelation: 'v_price_list_derivations';
            referencedColumns: ['master_id'];
          },
          {
            foreignKeyName: 'price_list_assignments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'price_list_assignments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      v_financial_alerts: {
        Row: {
          amount: number | null;
          created_at: string | null;
          event_type: string | null;
          hours_ago: number | null;
          id: string | null;
          message: string | null;
          metadata: Json | null;
          severity: string | null;
          tracking_number: string | null;
          user_email: string | null;
        };
        Insert: {
          amount?: number | null;
          created_at?: string | null;
          event_type?: string | null;
          hours_ago?: never;
          id?: string | null;
          message?: string | null;
          metadata?: Json | null;
          severity?: string | null;
          tracking_number?: string | null;
          user_email?: string | null;
        };
        Update: {
          amount?: number | null;
          created_at?: string | null;
          event_type?: string | null;
          hours_ago?: never;
          id?: string | null;
          message?: string | null;
          metadata?: Json | null;
          severity?: string | null;
          tracking_number?: string | null;
          user_email?: string | null;
        };
        Relationships: [];
      };
      v_financial_audit_stats: {
        Row: {
          avg_amount: number | null;
          date: string | null;
          event_count: number | null;
          event_type: string | null;
          severity: string | null;
          total_amount: number | null;
        };
        Relationships: [];
      };
      v_platform_daily_pnl: {
        Row: {
          avg_billed: number | null;
          avg_margin: number | null;
          avg_margin_percent: number | null;
          avg_provider_cost: number | null;
          cost_estimated: number | null;
          cost_from_api: number | null;
          cost_from_list: number | null;
          courier_code: string | null;
          date: string | null;
          discrepancy_count: number | null;
          negative_margin_count: number | null;
          shipments_count: number | null;
          total_billed: number | null;
          total_margin: number | null;
          total_provider_cost: number | null;
        };
        Relationships: [];
      };
      v_platform_margin_alerts: {
        Row: {
          alert_type: string | null;
          billed_amount: number | null;
          billed_user_id: string | null;
          cost_source: string | null;
          courier_code: string | null;
          created_at: string | null;
          id: string | null;
          platform_margin: number | null;
          platform_margin_percent: number | null;
          provider_cost: number | null;
          reconciliation_status: string | null;
          service_type: string | null;
          shipment_id: string | null;
          shipment_tracking_number: string | null;
          user_email: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_provider_costs_billed_user_id_fkey';
            columns: ['billed_user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_billed_user_id_fkey';
            columns: ['billed_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: true;
            referencedRelation: 'anne_all_shipments_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: true;
            referencedRelation: 'shipments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: true;
            referencedRelation: 'shipments_active';
            referencedColumns: ['id'];
          },
        ];
      };
      v_platform_monthly_pnl: {
        Row: {
          accurate_cost_count: number | null;
          avg_margin_percent: number | null;
          cost_accuracy_percent: number | null;
          gross_margin: number | null;
          margin_percent_of_revenue: number | null;
          month: string | null;
          negative_margin_count: number | null;
          total_cost: number | null;
          total_revenue: number | null;
          total_shipments: number | null;
          unique_couriers: number | null;
          unique_users: number | null;
          unresolved_discrepancies: number | null;
        };
        Relationships: [];
      };
      v_price_list_derivations: {
        Row: {
          derived_count: number | null;
          derived_ids: string[] | null;
          derived_names: string[] | null;
          master_courier_id: string | null;
          master_id: string | null;
          master_list_type: string | null;
          master_name: string | null;
          master_status: string | null;
        };
        Relationships: [];
      };
      v_reconciliation_pending: {
        Row: {
          age_days: number | null;
          billed_amount: number | null;
          courier_code: string | null;
          created_at: string | null;
          id: string | null;
          invoice_discrepancy: number | null;
          platform_margin: number | null;
          provider_cost: number | null;
          provider_invoice_amount: number | null;
          provider_invoice_date: string | null;
          provider_invoice_id: string | null;
          reconciliation_notes: string | null;
          reconciliation_status: string | null;
          shipment_id: string | null;
          shipment_tracking_number: string | null;
          user_email: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_provider_costs_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: true;
            referencedRelation: 'anne_all_shipments_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: true;
            referencedRelation: 'shipments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_shipment_id_fkey';
            columns: ['shipment_id'];
            isOneToOne: true;
            referencedRelation: 'shipments_active';
            referencedColumns: ['id'];
          },
        ];
      };
      v_reseller_monthly_platform_usage: {
        Row: {
          avg_margin_percent: number | null;
          avg_per_shipment: number | null;
          billed_user_id: string | null;
          couriers_used: string[] | null;
          margin_generated: number | null;
          month: string | null;
          parent_reseller_email: string | null;
          parent_reseller_id: string | null;
          prev_month_shipments: number | null;
          prev_month_spent: number | null;
          shipments_count: number | null;
          total_spent: number | null;
          user_email: string | null;
          user_name: string | null;
          user_type: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_provider_costs_billed_user_id_fkey';
            columns: ['billed_user_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'platform_provider_costs_billed_user_id_fkey';
            columns: ['billed_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'users_parent_reseller_id_fkey';
            columns: ['parent_reseller_id'];
            isOneToOne: false;
            referencedRelation: 'top_customers';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'users_parent_reseller_id_fkey';
            columns: ['parent_reseller_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      v_shipments_by_api_source: {
        Row: {
          api_source: string | null;
          avg_cost: number | null;
          first_shipment: string | null;
          last_shipment: string | null;
          total_revenue: number | null;
          total_shipments: number | null;
          unique_users: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      acquire_automation_lock: {
        Args: {
          p_config_id: string;
          p_duration_minutes?: number;
          p_lock_type: string;
          p_locked_by?: string;
          p_reason?: string;
        };
        Returns: string;
      };
      acquire_idempotency_lock: {
        Args: {
          p_idempotency_key: string;
          p_ttl_minutes?: number;
          p_user_id: string;
        };
        Returns: {
          acquired: boolean;
          error_message: string;
          result_shipment_id: string;
          status: string;
        }[];
      };
      add_wallet_credit:
        | {
            Args: {
              p_amount: number;
              p_created_by?: string;
              p_description?: string;
              p_user_id: string;
            };
            Returns: string;
          }
        | {
            Args: {
              p_amount: number;
              p_created_by?: string;
              p_description?: string;
              p_idempotency_key?: string;
              p_user_id: string;
            };
            Returns: string;
          };
      anne_get_shipments_stats: {
        Args: never;
        Returns: {
          csv_imported: number;
          deleted_count: number;
          ecommerce_synced: number;
          excel_imported: number;
          manual_created: number;
          ocr_created: number;
          other_platform: number;
          pdf_imported: number;
          total_shipments: number;
          unverified_count: number;
          verified_count: number;
        }[];
      };
      anne_search_shipments: {
        Args: { p_limit?: number; p_search_term: string };
        Returns: {
          created_at: string;
          id: string;
          recipient_city: string;
          recipient_name: string;
          relevance: number;
          source_category: string;
          status: string;
          tracking_number: string;
        }[];
      };
      anonymize_user_account: {
        Args: { p_deletion_uuid?: string; p_user_id: string };
        Returns: boolean;
      };
      approve_top_up_request: {
        Args: {
          p_admin_user_id: string;
          p_approved_amount: number;
          p_request_id: string;
        };
        Returns: {
          error_message: string;
          success: boolean;
          updated_id: string;
        }[];
      };
      assign_price_list: {
        Args: {
          p_caller_id?: string;
          p_notes?: string;
          p_price_list_id: string;
          p_user_id: string;
        };
        Returns: string;
      };
      calculate_volumetric_weight: {
        Args: { p_height: number; p_length: number; p_width: number };
        Returns: number;
      };
      calculate_volumetric_weight_from_price_list: {
        Args: {
          p_height: number;
          p_length: number;
          p_price_list_id: string;
          p_width: number;
        };
        Returns: number;
      };
      calculate_volumetric_weight_with_factor: {
        Args: {
          p_density_factor?: number;
          p_height: number;
          p_length: number;
          p_width: number;
        };
        Returns: number;
      };
      can_access_price_list: {
        Args: { p_price_list_id: string; p_user_id: string };
        Returns: boolean;
      };
      can_anonymize_user: {
        Args: { p_requester_email: string; p_user_email: string };
        Returns: boolean;
      };
      change_user_role: {
        Args: {
          p_admin_email: string;
          p_new_role: Database['public']['Enums']['user_role'];
          p_target_user_email: string;
        };
        Returns: boolean;
      };
      check_automation_lock: {
        Args: { p_config_id: string };
        Returns: {
          expires_at: string;
          has_lock: boolean;
          lock_type: string;
          locked_at: string;
          locked_by: string;
          minutes_remaining: number;
        }[];
      };
      check_reseller_team_permission: {
        Args: { p_permission: string; p_user_id: string };
        Returns: boolean;
      };
      cleanup_audit_logs: {
        Args: {
          financial_retention_days?: number;
          standard_retention_days?: number;
          system_retention_days?: number;
        };
        Returns: {
          category: string;
          deleted_count: number;
        }[];
      };
      cleanup_expired_idempotency_locks: { Args: never; Returns: number };
      cleanup_expired_locks: { Args: never; Returns: undefined };
      cleanup_expired_ocr_logs: { Args: never; Returns: number };
      cleanup_old_audit_logs: { Args: never; Returns: number };
      clone_price_list: {
        Args: {
          p_new_name: string;
          p_overrides?: Json;
          p_source_id: string;
          p_target_user_id?: string;
        };
        Returns: string;
      };
      complete_idempotency_lock: {
        Args: {
          p_idempotency_key: string;
          p_shipment_id: string;
          p_status?: string;
        };
        Returns: boolean;
      };
      create_shipments_table_complete: { Args: never; Returns: undefined };
      decrement_wallet_balance: {
        Args: {
          p_amount: number;
          p_idempotency_key?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      deduct_wallet_credit: {
        Args: {
          p_amount: number;
          p_description?: string;
          p_reference_id?: string;
          p_reference_type?: string;
          p_type: string;
          p_user_id: string;
        };
        Returns: string;
      };
      delete_user_complete: {
        Args: {
          p_admin_email: string;
          p_admin_id: string;
          p_target_user_email: string;
          p_target_user_name: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      extend_automation_lock: {
        Args: {
          p_additional_minutes?: number;
          p_config_id: string;
          p_lock_id: string;
        };
        Returns: boolean;
      };
      fail_idempotency_lock: {
        Args: { p_error_message: string; p_idempotency_key: string };
        Returns: boolean;
      };
      find_stale_api_keys: {
        Args: never;
        Returns: {
          days_since_use: number;
          id: string;
          last_used_at: string;
          name: string;
          user_id: string;
        }[];
      };
      fix_existing_shipments_table: { Args: never; Returns: undefined };
      generate_invoice_from_recharges: {
        Args: {
          p_invoice_type?: string;
          p_notes?: string;
          p_period_end?: string;
          p_period_start?: string;
          p_transaction_ids: string[];
          p_user_id: string;
        };
        Returns: string;
      };
      get_admin_overview_stats: {
        Args: { include_test?: boolean };
        Returns: {
          revenue_this_month: number;
          revenue_this_week: number;
          revenue_today: number;
          shipments_delivered: number;
          shipments_failed: number;
          shipments_in_transit: number;
          shipments_pending: number;
          shipments_this_month: number;
          shipments_this_week: number;
          shipments_today: number;
          total_revenue: number;
          total_shipments: number;
        }[];
      };
      get_ai_model: { Args: never; Returns: string };
      get_ai_provider: { Args: never; Returns: string };
      get_api_key_stats: {
        Args: { key_id: string };
        Returns: {
          avg_response_time_ms: number;
          error_rate: number;
          last_used: string;
          requests_last_24h: number;
          requests_last_7d: number;
          total_requests: number;
        }[];
      };
      get_applicable_price_list: {
        Args: { p_courier_id?: string; p_date?: string; p_user_id: string };
        Returns: {
          default_margin_fixed: number;
          default_margin_percent: number;
          id: string;
          name: string;
          priority: string;
          rules: Json;
        }[];
      };
      get_audit_log_stats: {
        Args: never;
        Returns: {
          logs_last_24h: number;
          logs_last_30d: number;
          logs_last_7d: number;
          newest_log: string;
          oldest_log: string;
          storage_estimate_mb: number;
          total_logs: number;
        }[];
      };
      get_compensation_alerts: {
        Args: never;
        Returns: {
          alert_type: string;
          created_at: string;
          days_pending: unknown;
          id: string;
          original_cost: number;
          retry_count: number;
          status: string;
          user_id: string;
        }[];
      };
      get_courier_config_for_user: {
        Args: { p_provider_id: string; p_user_id: string };
        Returns: {
          account_type: string;
          api_key: string;
          api_secret: string;
          base_url: string;
          contract_mapping: Json;
          id: string;
          is_active: boolean;
          name: string;
          owner_user_id: string;
          provider_id: string;
        }[];
      };
      get_courier_config_with_valid_session: {
        Args: { p_provider_id: string; p_user_id?: string };
        Returns: {
          api_key: string;
          base_url: string;
          contract_mapping: Json;
          id: string;
          is_active: boolean;
          name: string;
          provider_id: string;
          session_data: Json;
        }[];
      };
      get_margin_by_courier: {
        Args: { p_start_date?: string };
        Returns: {
          avg_margin_percent: number;
          courier_code: string;
          gross_margin: number;
          total_cost: number;
          total_revenue: number;
          total_shipments: number;
        }[];
      };
      get_platform_fee: { Args: { p_user_id: string }; Returns: number };
      get_platform_fee_cascading: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_platform_fee_details: {
        Args: { p_user_id: string };
        Returns: {
          fee: number;
          source: string;
          source_user_email: string;
          source_user_id: string;
        }[];
      };
      get_platform_stats: {
        Args: never;
        Returns: {
          avg_margin_percent: number;
          last_30_days_shipments: number;
          negative_margin_count: number;
          pending_reconciliation: number;
          total_cost: number;
          total_margin: number;
          total_revenue: number;
          total_shipments: number;
        }[];
      };
      get_price_list_audit_events: {
        Args: {
          p_actor_id?: string;
          p_event_types?: string[];
          p_limit?: number;
          p_offset?: number;
          p_price_list_id: string;
        };
        Returns: {
          actor_email: string;
          actor_id: string;
          actor_type: string;
          created_at: string;
          event_type: string;
          id: string;
          message: string;
          metadata: Json;
          new_value: Json;
          old_value: Json;
          severity: string;
          total_count: number;
        }[];
      };
      get_reseller_tier: {
        Args: { p_user_id: string };
        Returns: Database['public']['Enums']['reseller_tier'];
      };
      get_top_resellers: {
        Args: { p_limit?: number; p_start_date?: string };
        Returns: {
          margin_generated: number;
          total_billed: number;
          total_shipments: number;
          user_email: string;
          user_id: string;
          user_name: string;
        }[];
      };
      get_user_active_features: {
        Args: { p_user_email: string };
        Returns: {
          activation_type: string;
          category: string;
          expires_at: string;
          feature_code: string;
          feature_name: string;
          is_free: boolean;
        }[];
      };
      get_user_price_lists: {
        Args: {
          p_courier_id?: string;
          p_is_global?: boolean;
          p_status?: string;
          p_user_id: string;
        };
        Returns: {
          assigned_to_user_id: string;
          courier_id: string;
          created_at: string;
          created_by: string;
          default_margin_fixed: number;
          default_margin_percent: number;
          description: string;
          id: string;
          is_global: boolean;
          last_used_at: string;
          list_type: string;
          master_list_id: string;
          metadata: Json;
          name: string;
          notes: string;
          parent_version_id: string;
          priority: string;
          rules: Json;
          source_file_name: string;
          source_file_url: string;
          source_metadata: Json;
          source_type: string;
          status: string;
          updated_at: string;
          usage_count: number;
          valid_from: string;
          valid_until: string;
          version: string;
        }[];
      };
      get_user_tenant: { Args: { p_user_id: string }; Returns: string };
      get_volumetric_density_factor: {
        Args: { p_price_list_id: string };
        Returns: number;
      };
      grant_ocr_vision_consent: {
        Args: { p_ip_address: string; p_user_agent: string; p_user_id: string };
        Returns: boolean;
      };
      has_capability: {
        Args: { p_capability_name: string; p_user_id: string };
        Returns: boolean;
      };
      increment_wallet_balance: {
        Args: {
          p_amount: number;
          p_idempotency_key?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      is_automation_encrypted: {
        Args: { p_config_id: string };
        Returns: boolean;
      };
      is_courier_config_in_use: {
        Args: { p_config_id: string };
        Returns: boolean;
      };
      is_reseller: { Args: { p_user_id: string }; Returns: boolean };
      is_sub_user_of: {
        Args: { p_admin_id: string; p_sub_user_id: string };
        Returns: boolean;
      };
      is_super_admin: { Args: { p_user_id: string }; Returns: boolean };
      log_financial_event: {
        Args: {
          p_actor_id?: string;
          p_amount?: number;
          p_event_type: string;
          p_message?: string;
          p_metadata?: Json;
          p_platform_cost_id?: string;
          p_severity?: string;
          p_shipment_id?: string;
          p_user_id?: string;
        };
        Returns: string;
      };
      log_ocr_processing:
        | {
            Args: {
              p_document_type: string;
              p_metadata?: Json;
              p_provider: string;
              p_user_id: string;
            };
            Returns: string;
          }
        | {
            Args: {
              p_consent_given?: boolean;
              p_error_code?: string;
              p_error_message?: string;
              p_extracted_fields?: Json;
              p_image_format?: string;
              p_image_hash?: string;
              p_image_size?: number;
              p_ip_address?: string;
              p_provider: string;
              p_status: string;
              p_user_agent?: string;
              p_user_id: string;
            };
            Returns: string;
          };
      log_price_list_event: {
        Args: {
          p_actor_id?: string;
          p_event_type: string;
          p_message?: string;
          p_metadata?: Json;
          p_new_value?: Json;
          p_old_value?: Json;
          p_price_list_id: string;
          p_severity?: string;
        };
        Returns: string;
      };
      log_security_event: {
        Args: {
          p_details?: Json;
          p_event_type: string;
          p_ip_address?: string;
          p_resource_id?: string;
          p_resource_type?: string;
          p_severity?: string;
          p_user_id?: string;
        };
        Returns: string;
      };
      log_unauthorized_access: {
        Args: {
          p_message: string;
          p_metadata?: Json;
          p_resource_id: string;
          p_resource_type: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      log_wallet_operation: {
        Args: {
          p_actor_id?: string;
          p_amount: number;
          p_balance_after: number;
          p_balance_before: number;
          p_operation: string;
          p_reason?: string;
          p_shipment_id?: string;
          p_user_id: string;
        };
        Returns: string;
      };
      mark_compensation_resolved:
        | {
            Args: { p_compensation_id: string; p_resolution_notes?: string };
            Returns: boolean;
          }
        | {
            Args: {
              p_compensation_id: string;
              p_resolution_notes?: string;
              p_resolved_by?: string;
            };
            Returns: boolean;
          };
      normalize_tracking_status: {
        Args: { raw_status: string };
        Returns: string;
      };
      record_platform_provider_cost: {
        Args: {
          p_api_source: string;
          p_billed_amount: number;
          p_billed_user_id: string;
          p_cost_source?: string;
          p_courier_code: string;
          p_master_price_list_id?: string;
          p_price_list_id?: string;
          p_provider_cost: number;
          p_service_type?: string;
          p_shipment_id: string;
          p_tracking_number: string;
        };
        Returns: string;
      };
      refresh_compensation_stats: { Args: never; Returns: undefined };
      release_automation_lock: {
        Args: { p_config_id: string; p_lock_id?: string };
        Returns: boolean;
      };
      reseller_assign_price_list: {
        Args: {
          p_caller_id?: string;
          p_notes?: string;
          p_price_list_id: string;
          p_user_id: string;
        };
        Returns: string;
      };
      reseller_clone_supplier_price_list: {
        Args: {
          p_caller_id?: string;
          p_description?: string;
          p_margin_type: string;
          p_margin_value?: number;
          p_new_name: string;
          p_source_id: string;
        };
        Returns: Json;
      };
      retry_compensation: { Args: { p_compensation_id: string }; Returns: Json };
      revoke_ocr_vision_consent: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      revoke_price_list_assignment: {
        Args: { p_assignment_id: string };
        Returns: boolean;
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { '': string }; Returns: string[] };
      soft_delete_shipment: {
        Args: { p_shipment_id: string; p_user_id?: string };
        Returns: boolean;
      };
      toggle_user_feature: {
        Args: {
          p_activate: boolean;
          p_activation_type?: string;
          p_admin_email: string;
          p_expires_at?: string;
          p_feature_code: string;
          p_target_user_email: string;
        };
        Returns: boolean;
      };
      update_shipments_schema: { Args: never; Returns: undefined };
      upsert_supplier_price_list_config: {
        Args: {
          p_accessory_services_config?: Json;
          p_carrier_code: string;
          p_cod_config?: Json;
          p_contract_code?: string;
          p_courier_config_id?: string;
          p_extra_config?: Json;
          p_insurance_config?: Json;
          p_notes?: string;
          p_pickup_config?: Json;
          p_price_list_id: string;
          p_storage_config?: Json;
        };
        Returns: string;
      };
      upsert_tracking_event: {
        Args: {
          p_carrier: string;
          p_event_date: string;
          p_fetched_at: string;
          p_location: string;
          p_provider: string;
          p_raw_data: Json;
          p_shipment_id: string;
          p_status: string;
          p_status_normalized: string;
          p_tracking_number: string;
        };
        Returns: string;
      };
      user_has_feature: {
        Args: { p_feature_code: string; p_user_email: string };
        Returns: boolean;
      };
      validate_session_data: { Args: { data: Json }; Returns: boolean };
      verify_wallet_integrity: {
        Args: { p_user_id: string };
        Returns: {
          calculated_balance: number;
          current_balance: number;
          discrepancy: number;
          is_consistent: boolean;
          user_id: string;
        }[];
      };
    };
    Enums: {
      account_type: 'user' | 'admin' | 'superadmin' | 'byoc' | 'reseller';
      cod_status_type: 'pending' | 'collected' | 'paid';
      courier_service_type: 'standard' | 'express' | 'economy' | 'same_day' | 'next_day';
      financial_event_type:
        | 'wallet_debit'
        | 'wallet_credit'
        | 'wallet_refund'
        | 'platform_cost_recorded'
        | 'platform_cost_updated'
        | 'reconciliation_started'
        | 'reconciliation_completed'
        | 'reconciliation_discrepancy'
        | 'margin_alert'
        | 'cost_estimation_fallback'
        | 'invoice_matched'
        | 'manual_adjustment';
      invoice_status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
      lead_status: 'new' | 'contacted' | 'qualified' | 'negotiation' | 'won' | 'lost';
      payment_method: 'credit_card' | 'paypal' | 'bank_transfer' | 'wallet' | 'cash';
      payment_status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'chargeback';
      recipient_type: 'B2C' | 'B2B';
      reseller_tier: 'small' | 'medium' | 'enterprise';
      return_status: 'requested' | 'processing' | 'completed' | 'cancelled';
      shipment_status:
        | 'draft'
        | 'pending'
        | 'processing'
        | 'shipped'
        | 'in_transit'
        | 'out_for_delivery'
        | 'delivered'
        | 'failed'
        | 'cancelled'
        | 'returned';
      user_role: 'admin' | 'user' | 'merchant' | 'agent' | 'manager' | 'support' | 'viewer';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_type: ['user', 'admin', 'superadmin', 'byoc', 'reseller'],
      cod_status_type: ['pending', 'collected', 'paid'],
      courier_service_type: ['standard', 'express', 'economy', 'same_day', 'next_day'],
      financial_event_type: [
        'wallet_debit',
        'wallet_credit',
        'wallet_refund',
        'platform_cost_recorded',
        'platform_cost_updated',
        'reconciliation_started',
        'reconciliation_completed',
        'reconciliation_discrepancy',
        'margin_alert',
        'cost_estimation_fallback',
        'invoice_matched',
        'manual_adjustment',
      ],
      invoice_status: ['draft', 'issued', 'paid', 'overdue', 'cancelled', 'refunded'],
      lead_status: ['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'],
      payment_method: ['credit_card', 'paypal', 'bank_transfer', 'wallet', 'cash'],
      payment_status: ['pending', 'authorized', 'captured', 'failed', 'refunded', 'chargeback'],
      recipient_type: ['B2C', 'B2B'],
      reseller_tier: ['small', 'medium', 'enterprise'],
      return_status: ['requested', 'processing', 'completed', 'cancelled'],
      shipment_status: [
        'draft',
        'pending',
        'processing',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'failed',
        'cancelled',
        'returned',
      ],
      user_role: ['admin', 'user', 'merchant', 'agent', 'manager', 'support', 'viewer'],
    },
  },
} as const;
