import { Component, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core/components/button';
import { TuiHint } from '@taiga-ui/core/directives/hint';

@Component({
  selector: 'app-root',
  imports: [TuiButton, TuiHint, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('Калькулятор облигаций');

  protected T = signal<number>(10);
  protected k = signal<number>(8);
  protected t = signal<number>(8);
  protected proc = signal<number>(5);
  protected E = signal<number>(70);

  protected validateT(value: number): void {
    if (value === null || value === undefined || isNaN(value) || value < 0 || value > 100) {
      this.T.set(10);
    } else {
      this.T.set(value);
    }
  }

  protected validateK(value: number): void {
    if (value === null || value === undefined || isNaN(value) || value < 0 || value > this.T()) {
      this.k.set(8);
    } else {
      this.k.set(value);
    }
  }

  protected validateTParam(value: number): void {
    if (value === null || value === undefined || isNaN(value) || value < 0 || value > this.T()) {
      this.t.set(8);
    } else {
      this.t.set(value);
    }
  }

  protected validateProc(value: number): void {
    if (value === null || value === undefined || isNaN(value) || value < 0) {
      this.proc.set(5);
    } else {
      this.proc.set(value);
    }
  }

  protected validateE(value: number): void {
    if (value === null || value === undefined || isNaN(value) || value < 0) {
      this.E.set(70);
    } else {
      this.E.set(value);
    }
  }

  protected validateAll(): void {
    this.validateT(this.T());
    this.validateK(this.k());
    this.validateTParam(this.t());
    this.validateProc(this.proc());
    this.validateE(this.E());
  }

  protected priceResult = signal<string>('---');
  protected forwardResult = signal<string>('---');
  protected futuresResult = signal<string>('---');
  protected callOptionResult = signal<string>('---');

  protected get zcbLabel(): string {
    return `Цена ZCB${this.T()}`;
  }

  protected get priceDescription(): string {
    return `Цена ${this.T()}-летней бескупонной облигации ZCB${this.T()}, рассчитанная по биномиальной модели ставок.`;
  }

  protected get forwardDescription(): string {
    return `Форвардная цена облигации ZCB${this.T()} с исполнением в момент времени t.`;
  }

  protected get futuresDescription(): string {
    return `Цена фьючерса на облигацию ZCB${this.T()} с исполнением в момент времени k (без дисконтирования).`;
  }

  protected get callDescription(): string {
    return `Цена американского опциона Call на фьючерс на облигацию ZCB${this.T()}.`;
  }

  protected calc(): void {
    this.validateAll();
    const T = this.T();
    const t = this.t();
    const k = this.k();
    const Pr = this.proc() / 100;
    const E = this.E();

    const n = T;
    const tn = 1;
    const sigma = 0.1;
    const u = Math.exp(sigma * Math.sqrt(tn));
    const d = 1 / u;
    const p = (Math.exp(Pr * tn) - d) / (u - d);
    const q = 1 - p;

    const prStavka: number[][] = Array(n + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));
    prStavka[n][0] = Pr * 100;

    let j = 1;
    for (let i = n - 1; i >= 0; i--) {
      prStavka[i][j] = prStavka[i + 1][j - 1] * u;
      j = j + 1;
    }

    for (let i = n; i >= 0; i--) {
      for (let j = 1; j <= n; j++) {
        if (prStavka[i][j] === 0) {
          prStavka[i][j] = prStavka[i][j - 1] * d;
        }
      }
    }

    const ZCB_T: number[][] = Array(n + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= n; i++) {
      ZCB_T[i][n] = 100;
    }

    let g = 1;
    for (let j = n - 1; j >= 0; j--) {
      for (let i = g; i <= n; i++) {
        ZCB_T[i][j] =
          (p * (ZCB_T[i - 1][j + 1] / 100) + q * (ZCB_T[i][j + 1] / 100)) /
          (1 + prStavka[i][j] / 100);
        ZCB_T[i][j] = ZCB_T[i][j] * 100;
      }
      if (j > 0) {
        g = g + 1;
      }
      if (ZCB_T[n][0] < 0) {
        this.priceResult.set(`${(0).toFixed(2)}%`);
      } else {
        this.priceResult.set(`${ZCB_T[n][0].toFixed(2)}%`);
      }
    }

    const ZCBt: number[][] = Array(t + 1)
      .fill(null)
      .map(() => Array(t + 1).fill(0));
    for (let i = 0; i <= t; i++) {
      ZCBt[i][t] = 100;
    }

    const prStavkaC: number[][] = [];
    for (let i = n - t; i <= n; i++) {
      prStavkaC.push(prStavka[i].slice(0, t + 1));
    }

    g = 1;
    for (let j = t - 1; j >= 0; j--) {
      for (let i = g; i <= t; i++) {
        ZCBt[i][j] =
          (p * (ZCBt[i - 1][j + 1] / 100) + q * (ZCBt[i][j + 1] / 100)) /
          (1 + prStavkaC[i][j] / 100);
        ZCBt[i][j] = ZCBt[i][j] * 100;
      }
      if (j > 0) {
        g = g + 1;
      }
    }

    const forwardValue = (ZCB_T[n][0] / ZCBt[t][0]) * 100;
    this.forwardResult.set(`${forwardValue.toFixed(2)}%`);

    const futV: number[][] = [];
    for (let i = n - k; i <= n; i++) {
      futV.push(ZCB_T[i].slice(0, k + 1));
    }

    g = 1;
    for (let j = k - 1; j >= 0; j--) {
      for (let i = g; i <= k; i++) {
        futV[i][j] = p * (futV[i - 1][j + 1] / 100) + q * (futV[i][j + 1] / 100);
        futV[i][j] = futV[i][j] * 100;
      }
      if (j > 0) {
        g = g + 1;
      }
    }
    this.futuresResult.set(`${futV[k][0].toFixed(2)}%`);

    const opCall: number[][] = Array(k + 1)
      .fill(null)
      .map(() => Array(k + 1).fill(0));
    for (let i = 0; i <= k; i++) {
      opCall[i][k] = Math.max(0, futV[i][k] - E);
    }

    g = 1;
    for (let j = k - 1; j >= 0; j--) {
      for (let i = g; i <= k; i++) {
        const a = p * (opCall[i - 1][j + 1] / 100);
        const b = q * (opCall[i][j + 1] / 100);
        const c = Math.exp((Pr * T) / k);
        const d = futV[i][j] / 100 - E / 100;
        opCall[i][j] = Math.max((a + b) / c, Math.max(0, d));
        opCall[i][j] = opCall[i][j] * 100;
      }
      if (j > 0) {
        g = g + 1;
      }
    }
    this.callOptionResult.set(`${opCall[k][0].toFixed(2)}%`);
  }
}
