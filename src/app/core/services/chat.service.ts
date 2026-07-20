import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export interface KnowledgeEntry {
  keywords: string[];
  question: string;
  answer: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private knowledgeBase: KnowledgeEntry[] = [
    {
      keywords: ['crear', 'radicar', 'pqr', 'petición', 'queja', 'reclamo', 'cómo', 'hacer'],
      question: '¿Cómo crear una PQR?',
      answer: 'Para crear una PQR ingresa al módulo "Nueva PQR" desde el menú lateral. Completa el formulario con título, categoría (Infraestructura, Seguridad, Salud, Medio Ambiente, Tránsito u Otros), descripción detallada, ubicación y prioridad. Una vez enviada, recibirás un número de radicado para hacer seguimiento.'
    },
    {
      keywords: ['estado', 'estados', 'etapa', 'proceso', 'seguimiento'],
      question: '¿Cuáles son los estados de una PQR?',
      answer: 'Una PQR puede tener los siguientes estados: Recibida (recién creada), En revisión (un operador la está analizando), En proceso (se están tomando acciones), Resuelta (se dio solución) o Rechazada (no procede). Puedes hacer seguimiento desde tu panel de usuario.'
    },
    {
      keywords: ['tiempo', 'respuesta', 'días', 'demora', 'cuánto', 'plazo'],
      question: '¿Cuánto tiempo tarda la respuesta?',
      answer: 'Los tiempos de respuesta varían según la prioridad y categoría: Prioridad Urgente: máximo 24 horas. Prioridad Alta: máximo 3 días hábiles. Prioridad Media: máximo 8 días hábiles. Prioridad Baja: máximo 15 días hábiles. Estos plazos aplican para la respuesta inicial.'
    },
    {
      keywords: ['categoría', 'categorias', 'tipo', 'tipos'],
      question: '¿Qué categorías de PQR existen?',
      answer: 'Las categorías disponibles son: Infraestructura (vías, puentes, espacios públicos), Seguridad (vigilancia, emergencias), Salud (hospitales, medicamentos), Medio Ambiente (árboles, contaminación), Tránsito (semáforos, señalización) y Otros (temas generales no cubiertos en las anteriores).'
    },
    {
      keywords: ['editar', 'modificar', 'cambiar', 'actualizar'],
      question: '¿Puedo editar mi PQR después de enviarla?',
      answer: 'Como ciudadano, solo puedes editar tu PQR si está en estado "Recibida". Una vez que un operador comienza a revisarla, el contenido ya no puede modificarse. Para cambios, contacta a la línea de atención ciudadana.'
    },
    {
      keywords: ['seguimiento', 'consultar', 'ver', 'radicado', 'número'],
      question: '¿Cómo hago seguimiento a mi PQR?',
      answer: 'Ingresa a "Mis PQR" desde el menú. Allí verás la lista completa de tus solicitudes con su estado actual. Puedes hacer clic en cualquier PQR para ver el detalle completo, incluyendo comentarios del operador.'
    },
    {
      keywords: ['asignar', 'operador', 'responsable', 'quién'],
      question: '¿Quién asigna un operador a mi PQR?',
      answer: 'Los supervisores asignan los operadores según la categoría y la carga de trabajo. No es posible solicitar un operador específico, pero puedes confiar en que la asignación se hace de manera equitativa y por especialidad.'
    },
    {
      keywords: ['rechazar', 'rechazada', 'apelar', 'inconforme'],
      question: '¿Qué pasa si mi PQR es rechazada?',
      answer: 'Si tu PQR es rechazada, recibirás un comentario explicando los motivos. Puedes crear una nueva PQR con información adicional o corregida. Si no estás de acuerdo, puedes solicitar revisión por parte del supervisor.'
    },
    {
      keywords: ['prioridad', 'prioridades', 'urgente', 'alta', 'media', 'baja'],
      question: '¿Cómo se define la prioridad de una PQR?',
      answer: 'Las prioridades son: Urgente (riesgo inminente para la vida o bienes), Alta (problema grave que afecta a una comunidad), Media (inconveniente significativo pero manejable) y Baja (solicitud de mejora o mantenimiento menor). El sistema valida la prioridad asignada.'
    },
    {
      keywords: ['contacto', 'teléfono', 'llamar', 'atención', 'línea'],
      question: '¿Cómo contactar a atención al ciudadano?',
      answer: 'Puedes llamar a la Línea de Atención Ciudadana: 01 8000 123 456 (gratuita), escribir al correo atencion@civicbq.gov.co, o visitar la oficina de atención en la Alcaldía Municipal, primer piso, en horario de 8:00 am a 5:00 pm.'
    },
    {
      keywords: ['telegram', 'bot', 'canal'],
      question: '¿Hay un bot de Telegram para PQR?',
      answer: 'Sí, contamos con un bot en Telegram @CivicBQbot que te permite crear y dar seguimiento a tus PQR desde la aplicación de mensajería. Escanea el código QR en nuestra página o busca el bot directamente en Telegram. (Nota: Esta funcionalidad estará disponible próximamente.)'
    },
    {
      keywords: ['resolver', 'solucionar', 'arreglar', 'solucion'],
      question: '¿Qué significa que una PQR esté "Resuelta"?',
      answer: 'El estado "Resuelta" significa que se ha dado solución completa al problema reportado. Recibirás un comentario detallando las acciones realizadas. Si consideras que el problema persiste, puedes crear una nueva PQR haciendo referencia a la anterior.'
    },
    {
      keywords: ['ayuda', 'soporte', 'asistencia', 'guía'],
      question: '¿Necesitas ayuda con la plataforma?',
      answer: 'Estoy aquí para ayudarte. Puedes preguntarme sobre: cómo crear PQR, estados y tiempos de respuesta, categorías disponibles, seguimiento de solicitudes, o cualquier otra duda sobre el sistema CivicBQ.'
    },
    {
      keywords: ['quien', 'quién', 'puede', 'acceso', 'rol', 'roles', 'permiso'],
      question: '¿Quiénes pueden usar el sistema?',
      answer: 'El sistema tiene cuatro roles: Ciudadano (crea y ve sus PQR), Operador (gestiona PQR asignadas), Supervisor (supervisa y asigna PQR) y Administrador (configura el sistema y gestiona usuarios). Cada rol tiene acceso a diferentes funcionalidades.'
    },
    {
      keywords: ['login', 'ingresar', 'iniciar', 'sesión', 'contraseña', 'olvidé'],
      question: '¿Olvidaste tu contraseña?',
      answer: 'Si olvidaste tu contraseña, contacta al administrador del sistema para restablecerla. Por seguridad, las contraseñas no pueden recuperarse directamente en la plataforma. El administrador te asignará una nueva contraseña temporal.'
    }
  ];

  ask(question: string): Observable<ChatMessage> {
    const normalizedQuestion = question.toLowerCase();
    
    let bestMatch: KnowledgeEntry | null = null;
    let bestScore = 0;

    for (const entry of this.knowledgeBase) {
      let score = 0;
      for (const keyword of entry.keywords) {
        if (normalizedQuestion.includes(keyword)) {
          score += keyword.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    let response: string;
    if (bestMatch && bestScore > 0) {
      response = bestMatch.answer;
    } else {
      response = 'Lo siento, no encontré información específica sobre tu consulta. Puedo ayudarte con temas como: cómo crear una PQR, estados y tiempos de respuesta, categorías disponibles, seguimiento de solicitudes. Por favor reformula tu pregunta o contacta a la línea de atención ciudadana 01 8000 123 456.';
    }

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      content: response,
      role: 'assistant',
      timestamp: new Date()
    };

    return of(message).pipe(delay(500));
  }
}
