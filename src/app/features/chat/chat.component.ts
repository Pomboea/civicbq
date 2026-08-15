import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WebSocketSubject } from 'rxjs/webSocket';
import { ChatService, ChatMessage } from '../../core/services/chat.service';
import { LiveChatService, LiveSession, LiveMessage, LiveEvent } from '../../core/services/livechat.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('chatMessages') private chatMessagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  newMessage = '';
  loading = false;
  showQuickReplies = true;

  // Estado del chat en vivo con asesor (WebSocket)
  liveSession: LiveSession | null = null;
  liveStatus: 'ia' | 'en_cola' | 'con_asesor' | 'cerrada' = 'ia';
  escalating = false;
  private ws: WebSocketSubject<any> | null = null;
  private lastLiveMessageId = 0;
  private renderedLive = new Set<number>();
  private destroyed = false;

  quickQuestions = [
    '¿Cómo crear una PQR?',
    '¿Cuáles son los estados de una PQR?',
    '¿Cuánto tiempo tarda la respuesta?',
    '¿Qué categorías existen?',
    '¿Cómo hago seguimiento?'
  ];

  constructor(
    private chatService: ChatService,
    private liveChatService: LiveChatService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.messages.push({
      id: 'welcome',
      content: '¡Hola! Soy el asistente virtual de CivicBQ. Puedo ayudarte con información sobre cómo crear y gestionar PQR. Si lo prefieres, también puedo comunicarte con un asesor humano. ¿En qué puedo ayudarte?',
      role: 'assistant',
      timestamp: new Date()
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.closeWs();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.chatMessagesContainer.nativeElement.scrollTop =
        this.chatMessagesContainer.nativeElement.scrollHeight;
    } catch {}
  }

  sendMessage(text?: string): void {
    const messageContent = text || this.newMessage.trim();
    if (!messageContent || this.loading) return;

    if (this.liveStatus !== 'ia') {
      this.sendLiveMessage(messageContent);
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: messageContent,
      role: 'user',
      timestamp: new Date()
    };
    this.messages.push(userMessage);
    this.newMessage = '';
    this.showQuickReplies = false;
    this.loading = true;

    this.chatService.ask(this.messages).subscribe(result => {
      this.messages.push(result.message);
      this.loading = false;
      if (result.escalate) {
        this.escalateToHuman();
      }
    });
  }

  askQuickQuestion(question: string): void {
    this.sendMessage(question);
  }

  // --- Chat en vivo con asesor humano (WebSocket) ---

  escalateToHuman(): void {
    if (this.escalating || this.liveStatus !== 'ia') return;
    this.escalating = true;

    const session = this.authService.getSession();
    const history = this.messages
      .filter(m => m.id !== 'welcome' && m.role !== 'system')
      .map(m => ({ sender: m.role, content: m.content }));

    this.liveChatService.createSession(session?.userId || 'anon', session?.nombre || 'Ciudadano', history)
      .subscribe({
        next: s => {
          this.liveSession = s;
          this.liveStatus = 'en_cola';
          this.escalating = false;
          this.connectWs();
        },
        error: () => {
          this.escalating = false;
          this.pushSystemMessage('No se pudo conectar con el servicio de asesores. Intenta de nuevo o llama a la línea 01 8000 123 456.');
        }
      });
  }

  private connectWs(): void {
    if (!this.liveSession || this.destroyed) return;
    this.ws = this.liveChatService.connect(this.liveSession.id);
    this.ws.subscribe({
      next: (ev: LiveEvent) => this.handleLiveEvent(ev),
      error: () => this.scheduleReconnect(),
      complete: () => {
        if (!this.destroyed && this.liveStatus !== 'cerrada') this.scheduleReconnect();
      }
    });
    // Sincroniza mensajes perdidos (incluye los generados antes de conectar)
    this.catchUp();
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.liveStatus === 'cerrada') return;
    setTimeout(() => this.connectWs(), 3000);
  }

  private closeWs(): void {
    if (this.ws) { this.ws.complete(); this.ws = null; }
  }

  private catchUp(): void {
    if (!this.liveSession) return;
    this.liveChatService.getMessages(this.liveSession.id, this.lastLiveMessageId).subscribe(msgs => {
      for (const m of msgs) this.renderLiveMessage(m);
    });
  }

  private handleLiveEvent(ev: LiveEvent): void {
    if (ev.type === 'message' && ev.message) {
      this.renderLiveMessage(ev.message);
    } else if (ev.type === 'status') {
      if (ev.agentName && this.liveSession) this.liveSession.agentName = ev.agentName;
      this.liveStatus = (ev.status as any) || this.liveStatus;
      if (this.liveStatus === 'cerrada') this.closeWs();
    } else if (ev.type === 'error') {
      this.pushSystemMessage(ev.detail || 'Error en la conversación.');
    }
  }

  private renderLiveMessage(m: LiveMessage): void {
    if (this.renderedLive.has(m.id)) return;
    this.renderedLive.add(m.id);
    this.lastLiveMessageId = Math.max(this.lastLiveMessageId, m.id);

    if (m.sender === 'system') {
      this.pushSystemMessage(m.content);
      return;
    }
    this.messages.push({
      id: `live-${m.id}`,
      content: m.content,
      role: m.sender === 'user' ? 'user' : 'assistant',
      senderName: m.sender === 'agent' ? m.senderName : undefined,
      timestamp: new Date(m.createdAt)
    });
  }

  private sendLiveMessage(content: string): void {
    if (!this.liveSession || this.liveStatus === 'cerrada') return;
    const session = this.authService.getSession();
    this.newMessage = '';

    if (!this.ws) {
      this.pushSystemMessage('Sin conexión en tiempo real. Reconectando...');
      this.scheduleReconnect();
      return;
    }
    try {
      this.liveChatService.sendOverWs(this.ws, 'user', session?.nombre || 'Ciudadano', content);
    } catch {
      this.pushSystemMessage('No se pudo enviar el mensaje. Reconectando...');
      this.scheduleReconnect();
    }
  }

  private pushSystemMessage(content: string): void {
    this.messages.push({ id: `sys-${Date.now()}-${Math.random()}`, content, role: 'system', timestamp: new Date() });
  }

  backToAI(): void {
    this.closeWs();
    this.liveSession = null;
    this.liveStatus = 'ia';
    this.lastLiveMessageId = 0;
    this.renderedLive.clear();
    this.pushSystemMessage('Has vuelto al asistente virtual. ¿En qué más puedo ayudarte?');
  }

  clearChat(): void {
    this.closeWs();
    this.liveSession = null;
    this.liveStatus = 'ia';
    this.lastLiveMessageId = 0;
    this.renderedLive.clear();
    this.messages = [];
    this.showQuickReplies = true;
    this.ngOnInit();
  }
}
