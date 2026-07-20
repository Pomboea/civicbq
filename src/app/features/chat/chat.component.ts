import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage } from '../../core/services/chat.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatMessages') private chatMessagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  newMessage = '';
  loading = false;
  showQuickReplies = true;

  quickQuestions = [
    '¿Cómo crear una PQR?',
    '¿Cuáles son los estados de una PQR?',
    '¿Cuánto tiempo tarda la respuesta?',
    '¿Qué categorías existen?',
    '¿Cómo hago seguimiento?'
  ];

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.messages.push({
      id: 'welcome',
      content: '¡Hola! Soy el asistente virtual de CivicBQ. Puedo ayudarte con información sobre cómo crear y gestionar PQR. ¿En qué puedo ayudarte?',
      role: 'assistant',
      timestamp: new Date()
    });
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

    this.chatService.ask(messageContent).subscribe(response => {
      this.messages.push(response);
      this.loading = false;
    });
  }

  askQuickQuestion(question: string): void {
    this.sendMessage(question);
  }

  clearChat(): void {
    this.messages = [];
    this.showQuickReplies = true;
    this.ngOnInit();
  }
}
