import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LiveChatService, LiveSession, LiveMessage } from '../../core/services/livechat.service';
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

  private lastMessageId = 0;
  private queueTimer: any = null;
  private chatTimer: any = null;

  constructor(private liveChatService: LiveChatService, private authService: AuthService) {}

  ngOnInit(): void {
    this.refreshLists();
    this.queueTimer = setInterval(() => this.refreshLists(), 5000);
    this.chatTimer = setInterval(() => this.pollMessages(), 3000);
  }

  ngOnDestroy(): void {
    if (this.queueTimer) clearInterval(this.queueTimer);
    if (this.chatTimer) clearInterval(this.chatTimer);
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
    this.selected = s;
    this.messages = [];
    this.lastMessageId = 0;
    this.liveChatService.getMessages(s.id, 0).subscribe(msgs => {
      this.messages = msgs;
      this.lastMessageId = msgs.length ? msgs[msgs.length - 1].id : 0;
    });
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
      this.refreshLists();
    });
  }

  send(): void {
    const content = this.newMessage.trim();
    if (!content || !this.selected || this.sending) return;
    this.sending = true;
    this.newMessage = '';

    this.liveChatService.sendMessage(this.selected.id, 'agent', this.myName, content).subscribe({
      next: m => {
        this.messages.push(m);
        this.lastMessageId = Math.max(this.lastMessageId, m.id);
        this.sending = false;
      },
      error: () => { this.sending = false; }
    });
  }

  private pollMessages(): void {
    if (!this.selected) return;
    this.liveChatService.getMessages(this.selected.id, this.lastMessageId).subscribe(msgs => {
      for (const m of msgs) {
        this.lastMessageId = Math.max(this.lastMessageId, m.id);
        this.messages.push(m);
      }
    });
  }
}
