import type { FinanceData } from "./finance";

export interface ApiUser {
  id: string;
  username: string;
}

export interface ApiAuthResponse {
  token: string;
  user: ApiUser;
}

export interface ApiBudgetData {
  finance_data: FinanceData | null;
  dark_mode: boolean;
  currency: string;
  updated_at?: string;
  revision: number;
}

export interface ApiSetupStatus {
  needsSetup: boolean;
  authEnabled: boolean;
}
