import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage } from '../../core/services/chat.service';
import { LiveChatService, LiveSession, LiveMessage } from '../../core/services/livechat.service';
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

  // Estado del chat en vivo con asesor
  liveSession: LiveSession | null = null;
  liveStatus: 'ia' | 'en_cola' | 'con_asesor' | 'cerrada' = 'ia';
  escalating = false;
  private lastLiveMessageId = 0;
  private pollTimer: any = null;

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
    this.stopPolling();
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

  // --- Chat en vivo con asesor humano ---

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
          this.pushSystemMessage('Solicitud enviada. Estás en la cola para hablar con un asesor humano...');
          this.startPolling();
        },
        error: () => {
          this.escalating = false;
          this.pushSystemMessage('No se pudo conectar con el servicio de asesores. Intenta de nuevo o llama a la línea 01 8000 123 456.');
        }
      });
  }

  private sendLiveMessage(content: string): void {
    if (!this.liveSession || this.liveStatus === 'cerrada') return;
    const session = this.authService.getSession();
    this.newMessage = '';

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content,
      role: 'user',
      timestamp: new Date()
    };
    this.messages.push(userMessage);

    this.liveChatService.sendMessage(this.liveSession.id, 'user', session?.nombre || 'Ciudadano', content)
      .subscribe({
        next: m => { this.lastLiveMessageId = Math.max(this.lastLiveMessageId, m.id); },
        error: () => this.pushSystemMessage('No se pudo enviar el mensaje. Verifica la conexión con el servidor.')
      });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.pollLive(), 3000);
  }

  private stopPolling(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  private pollLive(): void {
    if (!this.liveSession) return;

    this.liveChatService.getSession(this.liveSession.id).subscribe(s => {
      this.liveSession = s;
      if (s.status !== this.liveStatus) {
        this.liveStatus = s.status;
      }
    });

    this.liveChatService.getMessages(this.liveSession.id, this.lastLiveMessageId).subscribe(msgs => {
      for (const m of msgs) {
        this.lastLiveMessageId = Math.max(this.lastLiveMessageId, m.id);
        this.pushLiveMessage(m);
      }
    });
  }

  private pushLiveMessage(m: LiveMessage): void {
    if (m.sender === 'user') return; // los mensajes propios ya se muestran al enviarlos
    if (m.sender === 'system') {
      // evita duplicar el mensaje de solicitud que ya mostramos localmente
      if (m.content.includes('solicita hablar con un asesor')) return;
      this.pushSystemMessage(m.content);
      return;
    }
    this.messages.push({
      id: `live-${m.id}`,
      content: m.content,
      role: 'assistant',
      senderName: m.sender === 'agent' ? m.senderName : undefined,
      timestamp: new Date(m.createdAt)
    });
  }

  private pushSystemMessage(content: string): void {
    this.messages.push({ id: `sys-${Date.now()}-${Math.random()}`, content, role: 'system', timestamp: new Date() });
  }

  backToAI(): void {
    this.stopPolling();
    this.liveSession = null;
    this.liveStatus = 'ia';
    this.lastLiveMessageId = 0;
    this.pushSystemMessage('Has vuelto al asistente virtual. ¿En qué más puedo ayudarte?');
  }

  clearChat(): void {
    this.stopPolling();
    this.liveSession = null;
    this.liveStatus = 'ia';
    this.lastLiveMessageId = 0;
    this.messages = [];
    this.showQuickReplies = true;
    this.ngOnInit();
  }
}
