// Fixtures literales del contrato PS-correcciones-liberacion; no datos de producción.
import { EstadoOperacion } from '../infrastructure/operacion.api';

export const ops_status_con_avisos = {
  "success": true,
  "data": {
    "version": "1.0.0",
    "git_sha": "3f2a9c1d",
    "app_env": "production",
    "revision_bd": "20261110_0035",
    "cabeza_codigo": "20261110_0035",
    "migraciones_pendientes": false,
    "ultimo_respaldo": {
      "id": "7b1e0c2a-0000-4000-8000-000000000001",
      "finished_at": "2026-11-06T07:21:40Z",
      "age_hours": 30.5,
      "alembic_revision": "20261110_0035"
    },
    "mantenimiento": false,
    "contadores": {
      "rate_limited": 41,
      "errors_5xx": 3,
      "rate_limited_by_policy": {
        "login_email_ip": 33,
        "ai_tenant": 6,
        "sync_device": 2
      },
      "sync_rechazadas_24h": 2,
      "cuentas_bloqueadas": 1,
      "mfa_adopcion": {
        "total": 3,
        "habilitadas": null
      }
    },
    "config_checks": [
      {
        "code": "backup_report_token_missing",
        "level": "warning",
        "message": "Falta BACKUP_REPORT_TOKEN: la puerta nunca encontrará copias verificadas."
      },
      {
        "code": "forwarded_ips_untrusted",
        "level": "warning",
        "message": "FORWARDED_ALLOW_IPS no está definido: los límites y la bitácora usan la IP del proxy."
      },
      {
        "code": "migration_exception_active",
        "level": "error",
        "message": "MIGRACION_SIN_RESPALDO_AUTORIZADA sigue definida. Quítala después de la publicación."
      },
      {
        "code": "backup_stale",
        "level": "warning",
        "message": "La última copia verificada tiene más de 26 h."
      },
      {
        "code": "sentry_missing",
        "level": "info",
        "message": "Rastreo de errores sin configurar (opcional)."
      }
    ]
  }
} satisfies { success: boolean; data: EstadoOperacion };

export const ops_status_ok = {
  "success": true,
  "data": {
    "version": "1.0.0",
    "git_sha": "3f2a9c1d",
    "app_env": "production",
    "revision_bd": "20261110_0035",
    "cabeza_codigo": "20261110_0035",
    "migraciones_pendientes": false,
    "ultimo_respaldo": {
      "id": "7b1e0c2a-0000-4000-8000-000000000001",
      "finished_at": "2026-11-06T07:21:40Z",
      "age_hours": 6.2,
      "alembic_revision": "20261110_0035"
    },
    "mantenimiento": false,
    "contadores": {
      "rate_limited": 41,
      "errors_5xx": 3,
      "rate_limited_by_policy": {
        "login_email_ip": 33,
        "ai_tenant": 6,
        "sync_device": 2
      },
      "sync_rechazadas_24h": 2,
      "cuentas_bloqueadas": 1,
      "mfa_adopcion": {
        "total": 3,
        "habilitadas": null
      }
    },
    "config_checks": [
      {
        "code": "sentry_missing",
        "level": "info",
        "message": "Rastreo de errores sin configurar (opcional)."
      }
    ]
  }
} satisfies { success: boolean; data: EstadoOperacion };

export const ops_status_sin_permiso = {
  "success": false,
  "error": {
    "code": "permission_denied",
    "message": "No tienes permiso para esta acción.",
    "details": null
  }
};

