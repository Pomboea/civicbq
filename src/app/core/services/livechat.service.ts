import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type LiveStatus = 'en_cola' | 'con_asesor' | 'cerrada';

export interface LiveSession {
  id: number;
  userId: string;
  userName: string;
  status: LiveStatus;
  agentId: string | null;
  agentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiveMessage {
  id: number;
  sessionId: number;
  sender: 'user' | 'assistant' | 'agent' | 'system';
  senderName: string;
  content: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LiveChatService {
  private readonly apiUrl = `${environment.apiUrl}/livechat`;

  constructor(private http: HttpClient) {}

  createSession(userId: string, userName: string, history: { sender: string; content: string }[]): Observable<LiveSession> {
    return this.http.post<LiveSession>(`${this.apiUrl}/sessions`, { user_id: userId, user_name: userName, history });
  }

  getSession(id: number): Observable<LiveSession> {
    return this.http.get<LiveSession>(`${this.apiUrl}/sessions/${id}`);
  }

  getQueue(): Observable<LiveSession[]> {
    return this.http.get<LiveSession[]>(`${this.apiUrl}/sessions?status=en_cola`);
  }

  getMyActive(agentId: string): Observable<LiveSession[]> {
    return this.http.get<LiveSession[]>(`${this.apiUrl}/sessions?status=con_asesor&agent_id=${agentId}`);
  }

  getMessages(id: number, afterId = 0): Observable<LiveMessage[]> {
    return this.http.get<LiveMessage[]>(`${this.apiUrl}/sessions/${id}/messages?after_id=${afterId}`);
  }

  sendMessage(id: number, sender: 'user' | 'agent', senderName: string, content: string): Observable<LiveMessage> {
    return this.http.post<LiveMessage>(`${this.apiUrl}/sessions/${id}/messages`, { sender, sender_name: senderName, content });
  }

  take(id: number, agentId: string, agentName: string): Observable<LiveSession> {
    return this.http.post<LiveSession>(`${this.apiUrl}/sessions/${id}/take`, { agent_id: agentId, agent_name: agentName });
  }

  close(id: number, by: string): Observable<LiveSession> {
    return this.http.post<LiveSession>(`${this.apiUrl}/sessions/${id}/close`, { by });
  }
}
