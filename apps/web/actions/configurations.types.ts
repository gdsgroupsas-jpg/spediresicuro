// Tipi per le configurazioni
export interface CourierConfigInput {
  id?: string; // Se presente, e un update
  name: string;
  provider_id: string;
  api_key: string;
  api_secret?: string;
  base_url: string;
  contract_mapping: Record<string, string>; // Es: { "poste": "CODE123", "gls": "CODE456" }
  is_active?: boolean;
  is_default?: boolean;
  description?: string;
  notes?: string;
  // Integration Hub: nuovi campi (opzionali per backward compatibility)
  status?: 'active' | 'error' | 'testing' | 'inactive';
  account_type?: 'admin' | 'byoc' | 'reseller';
  owner_user_id?: string;
}

export interface CourierConfig {
  id: string;
  name: string;
  provider_id: string;
  api_key: string; // In produzione, considerare mascherare o non esporre
  api_secret?: string;
  base_url: string;
  contract_mapping: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Integration Hub: nuovi campi (opzionali per backward compatibility)
  status?: 'active' | 'error' | 'testing' | 'inactive';
  last_tested_at?: string;
  test_result?: {
    success: boolean;
    error?: string;
    tested_at: string;
    response_time_ms?: number;
  };
  account_type?: 'admin' | 'byoc' | 'reseller';
  owner_user_id?: string;
  // Automation (gia esistenti da migration 015)
  automation_enabled?: boolean;
  automation_settings?: any;
  session_data?: any;
  last_automation_sync?: string;
  automation_encrypted?: boolean;
}
