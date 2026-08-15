import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WebSocketSubject } from 'rxjs/webSocket';
import { LiveChatService, LiveSession, LiveMessage, LiveEvent } from '../../core/services/livechat.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-livechat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './livechat.component.html',
  styleUrls: ['./livechat.component.css']
})
export class LiveChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('agentMessages') private messagesContainer!: ElementRef;

  queue: LiveSession[] = [];
  myActive: LiveSession[] = [];
  selected: LiveSession | null = null;
  messages: LiveMessage[] = [];
  newMessage = '';
  sending = false;

  private ws: WebSocketSubject<any> | null = null;
  private lastMessageId = 0;
  private rendered = new Set<number>();
  private queueTimer: any = null;
  private destroyed = false;

  constructor(private liveChatService: LiveChatService, private authService: AuthService) {}

  ngOnInit(): void {
    this.refreshLists();
    this.queueTimer = setInterval(() => this.refreshLists(), 5000);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.queueTimer) clearInterval(this.queueTimer);
    this.closeWs();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    } catch {}
  }

  get myId(): string { return this.authService.getSession()?.userId || ''; }
  get myName(): string { return this.authService.getSession()?.nombre || 'Asesor'; }

  refreshLists(): void {
    this.liveChatService.getQueue().subscribe(q => this.queue = q);
    this.liveChatService.getMyActive(this.myId).subscribe(m => this.myActive = m);
  }

  open(s: LiveSession): void {
    if (this.selected?.id === s.id) return;
    this.closeWs();
    this.selected = s;
    this.messages = [];
    this.lastMessageId = 0;
    this.rendered.clear();

    // Historial inicial por REST, mensajes nuevos por WebSocket
    this.liveChatService.getMessages(s.id, 0).subscribe(msgs => {
      for (const m of msgs) this.renderMessage(m);
      this.connectWs();
    });
  }

  private connectWs(): void {
    if (!this.selected || this.destroyed) return;
    this.ws = this.liveChatService.connect(this.selected.id);
    this.ws.subscribe({
      next: (ev: LiveEvent) => this.handleEvent(ev),
      error: () => this.scheduleReconnect(),
      complete: () => {
        if (!this.destroyed && this.selected && this.selected.status !== 'cerrada') this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.destroyed || !this.selected || this.selected.status === 'cerrada') return;
    setTimeout(() => this.connectWs(), 3000);
  }

  private closeWs(): void {
    if (this.ws) { this.ws.complete(); this.ws = null; }
  }

  private handleEvent(ev: LiveEvent): void {
    if (ev.type === 'message' && ev.message) {
      this.renderMessage(ev.message);
    } else if (ev.type === 'status') {
      if (this.selected && ev.status) this.selected.status = ev.status;
      if (ev.status === 'cerrada') {
        this.closeWs();
        this.refreshLists();
      }
    }
  }

  private renderMessage(m: LiveMessage): void {
    if (this.rendered.has(m.id)) return;
    this.rendered.add(m.id);
    this.lastMessageId = Math.max(this.lastMessageId, m.id);
    this.messages.push(m);
  }

  take(s: LiveSession, event?: Event): void {
    event?.stopPropagation();
    this.liveChatService.take(s.id, this.myId, this.myName).subscribe({
      next: updated => {
        this.refreshLists();
        this.open(updated);
      },
      error: () => alert('La sesión ya fue tomada por otro asesor.')
    });
  }

  close(): void {
    if (!this.selected) return;
    if (!confirm('¿Cerrar esta conversación?')) return;
    this.liveChatService.close(this.selected.id, this.myName).subscribe(() => {
      this.selected = null;
      this.messages = [];
      this.closeWs();
      this.refreshLists();
    });
  }

  send(): void {
    const content = this.newMessage.trim();
    if (!content || !this.selected || this.sending || !this.ws) return;
    this.sending = true;
    this.newMessage = '';
    try {
      this.liveChatService.sendOverWs(this.ws, 'agent', this.myName, content);
    } catch {
      this.pushLocalError('No se pudo enviar el mensaje. Reconectando...');
      this.scheduleReconnect();
    }
    this.sending = false;
  }

  private pushLocalError(text: string): void {
    this.messages.push({
      id: -Date.now(), sessionId: this.selected?.id || 0,
      sender: 'system', senderName: '', content: text, createdAt: new Date().toISOString()
    });
  }
}
