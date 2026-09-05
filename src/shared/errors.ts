import { HttpErrorResponse } from '@angular/common/http';
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0)
      return 'No se pudo conectar con el servidor. Comprobá que el backend esté encendido e intentá nuevamente.';
    const body = error.error;
    const detail = body?.error?.details;
    const fields = Array.isArray(detail)
      ? detail
          .map((d: { field?: string; message?: string }) =>
            [d.field, d.message].filter(Boolean).join(': '),
          )
          .join(' · ')
      : Array.isArray(detail?.errors)
        ? detail.errors.join(' · ')
        : '';
    return [
      body?.error?.message ||
        (error.status === 403
          ? 'No tenés permiso para esta operación.'
          : 'No se pudo completar la operación.'),
      fields,
    ]
      .filter(Boolean)
      .join(' ');
  }
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado. Intentá nuevamente.';
}
