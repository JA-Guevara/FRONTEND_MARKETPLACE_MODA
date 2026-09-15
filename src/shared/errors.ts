import { HttpErrorResponse } from '@angular/common/http';
interface Issue {
  field?: string;
  message?: string;
  msg?: string;
  loc?: Array<string | number> | string;
}
interface ErrorBody {
  error?: { message?: string; details?: string | Issue[] };
  detail?: string | Issue[];
}
/** Mensaje para el usuario a partir de un error: soporta el envoltorio propio
 * ({ error: { message, details } }) y lo que lanza FastAPI/HTTPException, que
 * responde ``{ detail: "..." }`` o ``{ detail: [{ loc, msg, type }] }``. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0)
      return 'No recibimos una respuesta del servidor. Puede ser una interrupción de conexión o un error del servicio. Reintentá en unos momentos.';
    const body = error.error as ErrorBody | undefined;
    const details = body?.error?.details ?? body?.detail;
    const message =
      body?.error?.message || (typeof details === 'string' ? details : '') || fallback(error.status);
    const fields = (Array.isArray(details) ? details : [])
      .map((d) => {
        const field = d.field || (Array.isArray(d.loc) ? d.loc.join('.') : String(d.loc ?? ''));
        const text = d.message ?? d.msg;
        return [field, text].filter(Boolean).join(': ');
      })
      .filter(Boolean)
      .join(' · ');
    return [message, fields].filter(Boolean).join(' ');
  }
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado. Intentá nuevamente.';
}
function fallback(status: number) {
  return status === 403 ? 'No tenés permiso para esta operación.' : 'No se pudo completar la operación.';
}