import { Question, SubmitPayload, SubmitResponse } from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'; // default backend port

export interface TutorAPI {
  start(id: string): Promise<{ ok: true }>;
  next(id: string, concept?: string): Promise<Question>;
  submit(p: SubmitPayload): Promise<SubmitResponse>;
}

class HttpAPI implements TutorAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async start(sessionId: string): Promise<{ ok: true }> {
    await this.request<{ session_id: string }>(`/start?session_id=${sessionId}`);
    return { ok: true };
  }

  async next(sessionId: string, concept: string = 'Maths Concept'): Promise<Question> {
    return this.request<Question>(`/next?session_id=${sessionId}&concept=${concept}`);
  }

  async submit(payload: SubmitPayload): Promise<SubmitResponse> {
    return this.request<SubmitResponse>('/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSessionStats(sessionId: string): Promise<{
    totalQuestions: number;
    accuracy: number;
    averageResponseTime: number;
    mastery: number;
  }> {
    return this.request(`/session/${sessionId}/stats`);
  }
}

export const apiClient: TutorAPI = new HttpAPI(API_BASE);
