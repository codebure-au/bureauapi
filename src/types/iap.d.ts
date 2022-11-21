interface AppleValidationResponse {
  environment: "Sandbox" | "Production";
  "is-retryable": boolean;
  latest_receipt: string;
  latest_receipt_info: AppleLatestReceipt[];
  pending_renewal_info: any[];
  receipt: any;
  status: number;
}

interface AppleLatestReceipt {
  app_account_token?: any;
  cancellation_date?: string;
  cancellation_date_ms?: string;
  cancellation_date_pst?: string;
  cancellation_reason?: string;
  expires_date?: string;
  expires_date_ms?: string;
  expires_date_pst?: string;
  in_app_ownership_type: string;
  is_in_intro_offer_period?: boolean;
  is_trial_period?: any;
  is_upgraded?: string;
  offer_code_ref_name?: any;
  original_purchase_date: string;
  original_purchase_date_ms: string;
  original_purchase_date_pst: string;
  original_transaction_id: string;
  product_id: string;
  promotional_offer_id?: string;
  purchase_date: string;
  purchase_date_ms: string;
  purchase_date_pst: string;
  quantity: string;
  subscription_group_identifier: string;
  web_order_line_item_id: string;
  transaction_id: string;
}
