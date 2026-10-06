import * as fs from 'node:fs';
import type { MonthChangeNotice } from '../../shared/ipc-contract';
import { MonthNormalizer } from './month-normalizer';
import { currentMonthKey } from './notifications';
import type { Repository } from '../persistence/repository';
import type { SyncService } from '../services/sync-service';

/** Cada cuánto se revisa si cambió el mes (la app puede quedar abierta días). */
const CHECK_INTERVAL_MS = 60_000;

/**
 * Parte fija de la ruta que precede al primer segmento con `{mes}`. Debe existir
 * para crear carpetas (evita fabricar rutas si, por ejemplo, Drive no está
 * montado). Vacío si el token está en el primer segmento.
 */
function staticPrefix(pattern: string): string {
  const parts = pattern.split(/([\\/]+)/);
  const out: string[] = [];
  for (const part of parts) {
    if (/\{mes\}/i.test(part)) {
      break;
    }
    out.push(part);
  }
  return out.join('').replace(/[\\/]+$/, '');
}

/**
 * Vigila el cambio de mes: cuando el mes actual deja de ser el último visto (o
 * al arrancar), crea las carpetas del mes en curso para cada mapeo que rota con
 * `{mes}` y avisa al renderer. La carpeta local se crea siempre; la de Drive
 * solo si el mapeo tiene activado "crear carpeta destino".
 */
export class MonthRollover {
  private readonly normalizer = new MonthNormalizer();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repo: Repository,
    private readonly sync: SyncService,
    private readonly emit: (notice: MonthChangeNotice) => void,
  ) {}

  start(): void {
    this.check();
    this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Crea las carpetas pendientes del mes actual y avisa si hubo cambio. */
  check(): void {
    const monthKey = currentMonthKey();
    const previous = this.repo.getLastMonthSeen();
    const created: string[] = [];
    const errors: string[] = [];

    for (const mapping of this.repo.listMappings()) {
      const targets: { pattern: string; dir: string }[] = [
        {
          pattern: mapping.localPattern,
          dir: this.sync.resolveLocalDir(mapping, monthKey),
        },
      ];
      if (mapping.createMissing) {
        targets.push({
          pattern: mapping.drivePattern,
          dir: this.sync.resolveDriveDir(mapping, monthKey),
        });
      }
      for (const { pattern, dir } of targets) {
        if (!/\{mes\}/i.test(pattern) || fs.existsSync(dir)) {
          continue;
        }
        const prefix = staticPrefix(pattern);
        if (prefix && !fs.existsSync(prefix)) {
          errors.push(`${mapping.name}: no existe ${prefix}`);
          continue;
        }
        try {
          fs.mkdirSync(dir, { recursive: true });
          created.push(dir);
        } catch (e) {
          errors.push(`${mapping.name}: ${String(e)}`);
        }
      }
    }

    this.repo.setLastMonthSeen(monthKey);
    const changed = previous !== '' && previous !== monthKey;
    if (changed || created.length > 0) {
      this.emit({
        monthKey,
        label: this.normalizer.render(monthKey, 'Mes-Año'),
        changed,
        created,
        errors,
      });
    }
  }
}
