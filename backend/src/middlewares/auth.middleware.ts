import type { RequestHandler } from 'express';
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../domain/errors.js';

export type Role = 'KITCHEN_OPERATOR' | 'DISPATCHER' | 'POS_SYSTEM' | 'ADMIN';
export const ANY_KDS_ROLE: Role[] = ['KITCHEN_OPERATOR', 'DISPATCHER', 'POS_SYSTEM', 'ADMIN'];

export interface Principal {
  username: string;
  roles: string[];
}

/** Valida un access token y dice quién es. Lanza UnauthorizedError si el token no sirve. */
export type TokenVerifier = (token: string) => Promise<Principal>;

interface KeycloakClaims {
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}

export interface OidcConfig {
  issuer: string;
  audience?: string;
  clientId: string;
}

// Keycloak caído o JWKS ilegible no es un token malo: debe salir como 500, no como 401.
const INFRA_ERRORS = new Set(['ERR_JWKS_TIMEOUT', 'ERR_JOSE_GENERIC']);

/** Verifica JWT RS256 de Keycloak (firma vía JWKS, `iss`, `exp`, y `aud` si se configura). Roles = los del realm + los del cliente `clientId`, igual que el frontend. */
export function oidcVerifier(
  cfg: OidcConfig,
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${cfg.issuer}/protocol/openid-connect/certs`)),
): TokenVerifier {
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer: cfg.issuer,
        audience: cfg.audience || undefined,
        algorithms: ['RS256'],
      });
      const claims = payload as KeycloakClaims;
      return {
        username: claims.preferred_username ?? payload.sub ?? 'desconocido',
        roles: [...(claims.realm_access?.roles ?? []), ...(claims.resource_access?.[cfg.clientId]?.roles ?? [])],
      };
    } catch (err) {
      if (err instanceof errors.JOSEError && !INFRA_ERRORS.has(err.code)) {
        throw new UnauthorizedError('Token inválido o vencido');
      }
      throw err;
    }
  };
}

/** Sin AUTH_ISSUER devuelve undefined y la API queda abierta (comportamiento previo, útil con el login mock). */
export function verifierFromEnv(): TokenVerifier | undefined {
  if (!env.AUTH_ISSUER) {
    console.warn('[auth] AUTH_ISSUER no definido: la API funciona SIN autenticación');
    return undefined;
  }
  return oidcVerifier({ issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE, clientId: env.AUTH_CLIENT_ID });
}

// Con la auth apagada todos entran como este usuario, así requireRole nunca necesita saber si está apagada.
const OPEN: Principal = { username: 'anonymous', roles: ANY_KDS_ROLE };

export function authenticate(verify?: TokenVerifier): RequestHandler {
  return async (req, res, next) => {
    if (!verify) {
      res.locals.principal = OPEN;
      return next();
    }
    const token = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.authorization ?? '')?.[1];
    if (!token) throw new UnauthorizedError('Falta el token Bearer');
    res.locals.principal = await verify(token);
    next();
  };
}

export function assertRole(principal: Principal, allowed: Role[]): void {
  if (!allowed.some((role) => principal.roles.includes(role))) {
    throw new ForbiddenError('No tienes permisos para esta operación');
  }
}

/** Debe ir después de `authenticate`; si falta, cierra por defecto (401). */
export function requireRole(...allowed: Role[]): RequestHandler {
  return (_req, res, next) => {
    const principal: Principal | undefined = res.locals.principal;
    if (!principal) throw new UnauthorizedError('No autenticado');
    assertRole(principal, allowed);
    next();
  };
}
