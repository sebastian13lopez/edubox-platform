// ═══════════════════════════════════════════════════════════════════
//  Eduvox — Shared Data Models
//  Todas las interfaces de la aplicación en un solo lugar.
//  Úsalas en los componentes con:  import { ... } from '../models/models';
// ═══════════════════════════════════════════════════════════════════

export interface Material {
  _id?: string;
  titulo: string;
  descripcion?: string;
  url?: string;
  fecha?: string;
}

// ─── Profesor: Curso asignado ───────────────────────────────────────
export interface Curso {
  id: number;
  nombre: string;
  horario: string;
  alumnos: number;
  color: string;         // Hex, usado como acento visual de la tarjeta
  materiales?: Material[];
}

// ─── Compartida: Registro de clase pasada (tabla de historial) ──────
export interface HistorialClase {
  id?: string;           // _id de MongoDB (opcional hasta que llegue del backend)
  fecha: string;         // 'DD MMM YYYY'
  curso: string;
  duracion: string;      // '1h 22min'
}

// ─── Profesor: Alumno conectado al aula en vivo ─────────────────────
export interface Participant {
  id: number;
  nombre: string;
  avatar: string;        // Inicial o letra
  conectado: boolean;
  hablando: boolean;
}

// ─── Profesor: Pregunta enviada por un alumno ───────────────────────
export interface Question {
  id: number;
  alumno: string;
  texto: string;
  tiempo: string;        // 'HH:MM AM/PM'
}

// ─── Profesor: Detalle de participación en el reporte de una clase ──
export interface ParticipationRecord {
  nombre: string;
  intervenciones: number;
  tiempoHablando: string; // '2m 15s'
}

// ─── Estudiante: Clase disponible para unirse ───────────────────────
export interface ClaseActiva {
  id: number;
  nombre: string;
  profesor: string;
  horaInicio: string;    // 'HH:MM AM/PM'
  tema: string;
  color: string;         // Hex
}

// ─── Estudiante: Fila del historial de participación ────────────────
export interface HistorialParticipacion {
  id?: string;
  fecha: string;
  curso: string;
  profesor: string;
  duracion: string;
}

// ─── Estudiante: Mensaje en el chat del Aula en Vivo ────────────────
export interface MensajeChat {
  id?: string;
  autor: string;
  texto: string;
  hora: string;
  esMio: boolean;        // true = mensaje del propio estudiante
}
