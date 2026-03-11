/*
 * ai-entry.js — ARCHIVO LEGACY (no se usa actualmente)
 *
 * La lógica de IA para análisis de imágenes está implementada
 * directamente en ai-entry.html (inline script).
 *
 * Este archivo se mantiene por compatibilidad pero NO se carga
 * en ninguna página. El código activo usa:
 *   - ANTHROPIC_PROXY (Supabase Edge Function) en lugar de api.anthropic.com
 *   - compressImage() con modo 'texto' para máxima resolución en lectura
 *   - Promise.all() para compresión y subida en paralelo
 *   - AbortController con timeout de 45s
 *   - max_tokens: 2000 para evitar JSON truncado
 *   - claude-haiku-4-5-20251001 para velocidad óptima
 *
 * Si necesitas modificar la lógica de IA, edita: /ai-entry.html
 * Si necesitas modificar la lógica de IA para Martech, edita: /ai-martech.html
 */
'use strict';
// (archivo vacío — ver ai-entry.html para la implementación activa)
