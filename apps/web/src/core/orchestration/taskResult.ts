export interface TaskResult {
  success: boolean;
  intentType: string;
  data: any;
  error?: string;
  timestamp: number;
}
