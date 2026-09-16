export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} no encontrado`);
  }
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`No se puede pasar de ${from} a ${to}`);
  }
}

export class VersionConflictError extends Error {
  constructor(public readonly orderId: string) {
    super(`El pedido ${orderId} fue modificado por otra pantalla`);
  }
}

export class DuplicateDisplayCodeError extends Error {
  constructor(public readonly displayCode: string) {
    super(`El código ${displayCode} ya existe`);
  }
}
