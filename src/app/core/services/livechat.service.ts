import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
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

export interface LiveEvent {
  type: 'message' | 'status' | 'error';
  message?: LiveMessage;
  status?: LiveStatus;
  agentName?: string;
  detail?: string;
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

  /** Abre el canal WebSocket de una sesión de chat en vivo. */
  connect(sessionId: number): WebSocketSubject<any> {
    const wsBase = environment.apiUrl.replace(/^http/, 'ws');
    return webSocket<any>(`${wsBase}/livechat/ws/${sessionId}`);
  }

  /** Envía un mensaje por el WebSocket (el servidor lo guarda y lo retransmite). */
  sendOverWs(ws: WebSocketSubject<any>, sender: 'user' | 'agent', senderName: string, content: string): void {
    ws.next({ type: 'message', sender, sender_name: senderName, content });
  }
}
