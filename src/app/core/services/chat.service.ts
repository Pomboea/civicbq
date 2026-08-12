import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  senderName?: string;
  timestamp: Date;
}

export interface AskResult {
  message: ChatMessage;
  escalate: boolean;
}

interface ChatApiResponse {
  reply: string;
  model: string;
  escalate: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly apiUrl = `${environment.apiUrl}/chat`;

  constructor(private http: HttpClient) {}

  ask(history: ChatMessage[]): Observable<AskResult> {
    const messages = history
      .filter(m => m.id !== 'welcome' && m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    return this.http.post<ChatApiResponse>(this.apiUrl, { messages }).pipe(
      map(res => ({ message: this.buildMessage(res.reply), escalate: res.escalate })),
      catchError(() => of({
        message: this.buildMessage(
          'No pude conectarme con el servicio de inteligencia artificial en este momento. ' +
          'Verifica que el backend y Ollama estén en ejecución, o contacta la línea de atención ciudadana 01 8000 123 456.'
        ),
        escalate: false
      }))
    );
  }

  private buildMessage(content: string): ChatMessage {
    return {
      id: `msg-${Date.now()}`,
      content,
      role: 'assistant',
      timestamp: new Date()
    };
  }
}
