import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  DuplicateDisplayCodeError,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  UnauthorizedError,
  VersionConflictError,
} from '../domain/errors.js';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
}

function toProblem(err: unknown): ProblemDetails {
  if (err instanceof ZodError) {
    return {
      type: 'https://kds.example.com/errors/validation',
      title: 'Datos inválidos',
      status: 422,
      detail: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  if (err instanceof InvalidTransitionError) {
    return {
      type: 'https://kds.example.com/errors/invalid-status-transition',
      title: 'Transición de Estado Inválida',
      status: 400,
      detail: err.message,
    };
  }
  if (err instanceof VersionConflictError) {
    return {
      type: 'https://kds.example.com/errors/version-conflict',
      title: 'Conflicto de Versión',
      status: 409,
      detail: err.message,
    };
  }
  if (err instanceof NotFoundError) {
    return { type: 'https://kds.example.com/errors/not-found', title: 'No Encontrado', status: 404, detail: err.message };
  }
  if (err instanceof DuplicateDisplayCodeError) {
    return { type: 'https://kds.example.com/errors/duplicate-code', title: 'Código Duplicado', status: 409, detail: err.message };
  }
  if (err instanceof UnauthorizedError) {
    return { type: 'https://kds.example.com/errors/unauthorized', title: 'No Autenticado', status: 401, detail: err.message };
  }
  if (err instanceof ForbiddenError) {
    return { type: 'https://kds.example.com/errors/forbidden', title: 'Acceso Denegado', status: 403, detail: err.message };
  }
  // Errores 4xx de express.json() (JSON malformado, body demasiado grande): traen su propio status.
  const status = (err as { status?: unknown })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return { type: 'about:blank', title: 'Petición Inválida', status, detail: (err as Error).message };
  }
  return { type: 'about:blank', title: 'Error Interno', status: 500, detail: 'Ocurrió un error inesperado' };
}

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const problem = toProblem(err);
  if (problem.status === 500) console.error(err);
  if (problem.status === 401) res.setHeader('WWW-Authenticate', 'Bearer');
  res.status(problem.status).json({ ...problem, instance: req.originalUrl });
}
