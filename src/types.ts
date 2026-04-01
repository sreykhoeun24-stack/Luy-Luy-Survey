export interface UserProfile {
  uid: string;
  display_name: string;
  verified_balance: number;
  aba_status: boolean;
  qr_url: string;
  email: string;
  role: 'admin' | 'specialist';
}

export interface PayoutHistory {
  id: string;
  amount: number;
  timestamp: any;
  source: string;
  status: string;
  survey_id: string;
}

export interface Survey {
  id: string;
  survey_id: string;
  provider_url: string;
  total_provider_reward: number; // USD
  user_display_reward: number; // USD
  active: boolean;
  loi?: string | number;
  type?: string;
  created_at?: any;
}

export interface ManualTask {
  id: string;
  title: string;
  url: string;
  payout_usd: number;
  user_reward_usd: number;
  active: boolean;
  created_at?: any;
}

export interface TaskSubmission {
  id: string;
  task_id: string;
  task_title: string;
  user_id: string;
  user_name: string;
  screenshot_url: string;
  qr_url: string;
  status: 'pending' | 'approved' | 'rejected';
  payout_usd: number;
  admin_profit_usd: number;
  rejection_reason?: string;
  timestamp: any;
}

export interface AdminFinances {
  total_revenue_usd: number;
  total_payout_usd: number;
  total_profit_usd: number;
  last_updated: any;
}

export interface ProfitLog {
  id: string;
  amount_usd: number;
  timestamp: any;
  survey_id: string;
  user_id: string;
}

export interface SurveyQuestion {
  id: string;
  text_en: string;
  text_km?: string;
  type: 'text' | 'multiple_choice';
  options?: string[];
}

export interface SurveyCompletion {
  id: string;
  user_id: string;
  survey_id: string;
  timestamp: any;
  reward_usd: number;
  answers: Record<string, string>;
}

export type Language = 'en' | 'km';

export interface BalanceHistory {
  id?: string;
  old_balance: number;
  new_balance: number;
  timestamp: any; // Firestore Timestamp
  reason: string;
}

export type Theme = 'night' | 'day';

export interface StatusMessage {
  text: string;
  type: 'success' | 'error';
}

export interface ChatMessage {
  id?: string;
  text?: string;
  image_url?: string;
  sender_id: string;
  timestamp: any;
  is_admin: boolean;
}

export interface Post {
  id: string;
  author_id: string;
  author_name: string;
  author_photo?: string;
  content: string;
  image_url?: string;
  likes_count: number;
  comments_count: number;
  timestamp: any;
  liked_by?: string[]; // Simplified for now, though a subcollection is better for scale
}

export interface Comment {
  id: string;
  author_id: string;
  author_name: string;
  content: string;
  timestamp: any;
}

export interface FriendRequest {
  id: string;
  from_id: string;
  from_name: string;
  to_id: string;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: any;
}

export interface Conversation {
  id: string;
  participants: string[];
  last_message: string;
  last_timestamp: any;
  unread_count: Record<string, number>;
}

export interface Settlement {
  id?: string;
  amount: number;
  timestamp: any;
  admin_uid: string;
  status: 'paid';
}
