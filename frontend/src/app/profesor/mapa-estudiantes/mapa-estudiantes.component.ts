import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { CursoService } from '../../services/curso.service';

declare const L: any;

@Component({
  selector: 'app-mapa-estudiantes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; font-family:'Inter',sans-serif; }

    .wrap {
      display:flex; flex-direction:column; gap:1.2rem;
      padding:1.5rem; height:100vh; box-sizing:border-box;
      background:#F1F5F9;
    }

    /* ── HEADER ── */
    .hdr {
      display:flex; align-items:center; justify-content:space-between;
      flex-wrap:wrap; gap:.8rem;
      background:linear-gradient(135deg,#0F172A,#1E3A5F);
      border-radius:16px; padding:1.2rem 1.6rem;
      box-shadow:0 4px 20px rgba(15,23,42,.3);
      flex-shrink:0;
    }
    .hdr-left { display:flex; align-items:center; gap:.9rem; }
    .hdr-ico {
      width:44px; height:44px; border-radius:12px;
      background:rgba(59,130,246,.2); border:1.5px solid rgba(59,130,246,.35);
      display:flex; align-items:center; justify-content:center;
    }
    .hdr-ico svg { width:22px; height:22px; color:#60A5FA; }
    .hdr h1 { margin:0; font-size:1.2rem; font-weight:800; color:#fff; }
    .hdr p  { margin:0; font-size:.72rem; color:#94A3B8; }
    .hdr-right { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; }

    select.cs {
      background:rgba(255,255,255,.08); border:1.5px solid rgba(255,255,255,.15);
      color:#fff; border-radius:10px; padding:.45rem .9rem;
      font-size:.82rem; outline:none; min-width:200px; cursor:pointer;
    }
    select.cs option { background:#1E293B; }

    .btn-r {
      display:flex; align-items:center; gap:.4rem;
      background:#2563EB; color:#fff; border:none;
      border-radius:10px; padding:.45rem 1rem;
      font-size:.82rem; font-weight:700; cursor:pointer;
      transition:background .2s;
    }
    .btn-r:hover:not(:disabled){ background:#1D4ED8; }
    .btn-r:disabled{ opacity:.5; cursor:not-allowed; }
    .btn-r svg { width:14px; height:14px; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin{ to{ transform:rotate(360deg); } }

    /* ── STATS ── */
    .stats { display:flex; gap:.8rem; flex-shrink:0; flex-wrap:wrap; }
    .sp {
      display:flex; align-items:center; gap:.7rem;
      background:#fff; border-radius:12px; padding:.7rem 1.1rem;
      flex:1; min-width:130px; border:1.5px solid #E2E8F0;
      box-shadow:0 2px 6px rgba(0,0,0,.05);
    }
    .sp svg { width:20px; height:20px; flex-shrink:0; }
    .sp-n { font-size:1.4rem; font-weight:800; color:#0F172A; line-height:1; }
    .sp-l { font-size:.65rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#94A3B8; }
    .sp.blue  { border-color:#DBEAFE; } .sp.blue  svg { color:#3B82F6; }
    .sp.green { border-color:#DCFCE7; } .sp.green svg { color:#22C55E; }
    .sp.yel   { border-color:#FEF9C3; } .sp.yel   svg { color:#EAB308; }
    .sp.pur   { border-color:#F3E8FF; } .sp.pur   svg { color:#A855F7; }

    /* ── BODY ── */
    .body {
      display:grid;
      grid-template-columns:1fr 300px;
      gap:1rem;
      flex:1;
      min-height:0;
    }
    @media(max-width:860px){ .body{ grid-template-columns:1fr; } }

    /* ── MAP CARD ── */
    .mc {
      background:#fff; border-radius:16px;
      border:1.5px solid #E2E8F0;
      box-shadow:0 4px 12px rgba(0,0,0,.07);
      display:flex; flex-direction:column;
      overflow:hidden; position:relative;
    }
    .mc-top {
      display:flex; align-items:center; justify-content:space-between;
      padding:.55rem 1rem; background:#F8FAFC;
      border-bottom:1px solid #E2E8F0; flex-shrink:0;
    }
    .badge-live  { display:flex; align-items:center; gap:.4rem; font-size:.72rem; font-weight:700; background:#DCFCE7; color:#16A34A; border-radius:99px; padding:.2rem .7rem; }
    .badge-idle  { font-size:.72rem; font-weight:700; background:#F1F5F9; color:#64748B; border-radius:99px; padding:.2rem .7rem; }
    .dot { width:7px; height:7px; border-radius:50%; background:#22C55E; animation:pulse 1.5s infinite; }
    @keyframes pulse{ 0%,100%{ opacity:1;transform:scale(1); } 50%{ opacity:.5;transform:scale(1.5); } }
    .attr { font-size:.65rem; color:#94A3B8; }

    /* Leaflet REQUIRES an explicit pixel height — flex:1 alone breaks tile rendering */
    #leaflet-map {
      height: calc(100vh - 240px);
      min-height: 420px;
      width: 100%;
    }

    /* ── SIDE PANEL ── */

    .sp-panel {
      background:#fff; border-radius:16px;
      border:1.5px solid #E2E8F0;
      box-shadow:0 4px 12px rgba(0,0,0,.06);
      display:flex; flex-direction:column;
      overflow:hidden; min-height:0;
    }
    .sp-hdr {
      display:flex; align-items:center; justify-content:space-between;
      padding:.85rem 1rem; border-bottom:1px solid #F1F5F9; flex-shrink:0;
    }
    .sp-hdr h3 { margin:0; font-size:.9rem; font-weight:700; color:#0F172A; }
    .cnt-b {
      background:#EFF6FF; color:#2563EB;
      font-size:.7rem; font-weight:700;
      border-radius:99px; padding:.15rem .55rem;
    }

    .s-list { flex:1; overflow-y:auto; padding:.4rem; }
    .s-row {
      display:flex; align-items:center; gap:.65rem;
      padding:.6rem .7rem; border-radius:9px;
      cursor:pointer; transition:background .15s;
    }
    .s-row:hover { background:#F8FAFC; }
    .av {
      width:34px; height:34px; border-radius:9px;
      display:flex; align-items:center; justify-content:center;
      font-weight:800; font-size:.85rem; color:#fff; flex-shrink:0;
    }
    .s-info { flex:1; min-width:0; }
    .s-info strong { display:block; font-size:.82rem; color:#0F172A; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .s-info small  { display:block; font-size:.7rem; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cc {
      font-size:.64rem; color:#94A3B8;
      background:#F1F5F9; border-radius:5px;
      padding:.15rem .4rem; white-space:nowrap; flex-shrink:0;
    }

    .s-empty {
      flex:1; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      padding:1.5rem; text-align:center; color:#94A3B8;
      gap:.6rem;
    }
    .s-empty svg { width:36px; height:36px; }
    .s-empty p   { font-size:.78rem; margin:0; }

    .idx-bar {
      display:flex; align-items:center; gap:.6rem;
      padding:.75rem 1rem; flex-shrink:0;
      background:linear-gradient(135deg,#1E3A5F,#0F172A);
      border-top:1px solid #334155;
    }
    .idx-ico {
      width:28px; height:28px; border-radius:7px;
      background:rgba(59,130,246,.2);
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .idx-ico svg { width:14px; height:14px; color:#60A5FA; }
    .idx-bar strong { display:block; font-size:.76rem; font-weight:700; color:#fff; }
    .idx-bar small  { font-size:.66rem; color:#64748B; }
  `],
  template: `
<div class="wrap">

  <!-- HEADER -->
  <div class="hdr">
    <div class="hdr-left">
      <div class="hdr-ico">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <circle cx="12" cy="11" r="3"/>
        </svg>
      </div>
      <div>
        <h1>Mapa de Estudiantes</h1>
        <p>Ubicaciones en tiempo real · Índice 2DSphere · MongoDB Atlas</p>
      </div>
    </div>
    <div class="hdr-right">
      <select class="cs" [(ngModel)]="cursoSel" (change)="cargar()">
        <option value="">Seleccionar curso...</option>
        <option *ngFor="let c of cursos" [value]="c._id">{{ c.nombre }}</option>
      </select>
      <button class="btn-r" (click)="cargar()" [disabled]="!cursoSel || loading">
        <svg *ngIf="!loading" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        <svg *ngIf="loading" class="spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        {{ loading ? 'Cargando...' : 'Actualizar' }}
      </button>
    </div>
  </div>

  <!-- STATS -->
  <div class="stats">
    <div class="sp blue">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2h5m0 0v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/>
      </svg>
      <div><div class="sp-n">{{ datos?.totalEstudiantes ?? '—' }}</div><div class="sp-l">Inscritos</div></div>
    </div>
    <div class="sp green">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
        <circle cx="12" cy="11" r="3"/>
      </svg>
      <div><div class="sp-n">{{ datos?.estudiantesConUbicacion ?? '—' }}</div><div class="sp-l">Localizados</div></div>
    </div>
    <div class="sp yel">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M4.93 19.07a10 10 0 010-14.14M7.757 16.243a6 6 0 010-8.486"/>
      </svg>
      <div>
        <div class="sp-n">{{ datos ? datos.totalEstudiantes - datos.estudiantesConUbicacion : '—' }}</div>
        <div class="sp-l">Sin señal</div>
      </div>
    </div>
    <div class="sp pur">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <div><div class="sp-n">{{ cobertura }}%</div><div class="sp-l">Cobertura</div></div>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- MAPA -->
    <div class="mc">
      <div class="mc-top">
        <span class="badge-live" *ngIf="datos?.estudiantesConUbicacion > 0"><span class="dot"></span>En vivo</span>
        <span class="badge-idle" *ngIf="!cursoSel">Selecciona un curso para ver ubicaciones</span>
        <span class="badge-idle" *ngIf="cursoSel && (!datos || datos.estudiantesConUbicacion === 0)">Sin ubicaciones registradas</span>
        <span class="attr">Leaflet · OpenStreetMap</span>
      </div>
      <div id="leaflet-map"></div>
    </div>


    <!-- SIDE PANEL -->
    <div class="sp-panel">
      <div class="sp-hdr">
        <h3>Estudiantes localizados</h3>
        <span class="cnt-b" *ngIf="datos">{{ datos.estudiantesConUbicacion }}</span>
      </div>

      <div class="s-list" *ngIf="datos?.estudiantes?.length; else noEst">
        <div class="s-row" *ngFor="let e of datos.estudiantes; let i=index" (click)="centrar(e)">
          <div class="av" [style.background]="color(i)">{{ e.nombre.charAt(0) }}</div>
          <div class="s-info">
            <strong>{{ e.nombre }}</strong>
            <small>{{ e.email }}</small>
          </div>
          <div class="cc">{{ e.latitud | number:'1.2-2' }}, {{ e.longitud | number:'1.2-2' }}</div>
        </div>
      </div>

      <ng-template #noEst>
        <div class="s-empty">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <circle cx="12" cy="11" r="3"/>
          </svg>
          <p>{{ cursoSel ? 'Ningún estudiante tiene ubicación aún' : 'Selecciona un curso para comenzar' }}</p>
        </div>
      </ng-template>

      <div class="idx-bar">
        <div class="idx-ico">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <div>
          <strong>Índice 2DSphere activo</strong>
          <small>Consultas geoespaciales · MongoDB Atlas</small>
        </div>
      </div>
    </div>

  </div>
</div>
  `
})
export class MapaEstudiantesComponent implements OnInit, AfterViewInit, OnDestroy {
  cursos: any[] = [];
  cursoSel = '';
  datos: any = null;
  loading = false;
  cobertura = 0;

  private mapa: any = null;
  private markers: any[] = [];
  private COLS = ['#3B82F6','#22C55E','#F59E0B','#EF4444','#A855F7','#EC4899','#14B8A6','#F97316'];
  private readonly API = 'http://localhost:3000/api/usuarios';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cs: CursoService,
    private router: Router
  ) {}

  ngOnInit() {
    const id = this.auth.getIdUsuario();
    if (id) this.cs.obtenerCursosProfesor(id).subscribe({ next: (d: any) => this.cursos = d });
  }

  ngAfterViewInit() {
    // Delay needed so Angular finishes rendering the DOM before Leaflet reads dimensions
    setTimeout(() => {
      this.initMap();
    }, 200);
  }

  ngOnDestroy() { if (this.mapa) { this.mapa.remove(); this.mapa = null; } }

  color(i: number) { return this.COLS[i % this.COLS.length]; }

  private initMap() {
    if (typeof L === 'undefined') { console.warn('Leaflet not loaded'); return; }
    const el = document.getElementById('leaflet-map');
    if (!el || el.clientHeight === 0) {
      // Retry if element isn't sized yet
      setTimeout(() => this.initMap(), 300);
      return;
    }
    this.mapa = L.map('leaflet-map', { zoomControl: true }).setView([4.711, -74.0721], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(this.mapa);
    // Force Leaflet to recalculate tile layout after DOM is settled
    setTimeout(() => this.mapa.invalidateSize(), 100);
  }

  cargar() {
    if (!this.cursoSel) return;
    this.loading = true;
    this.http.get<any>(`${this.API}/curso/${this.cursoSel}/ubicaciones`).subscribe({
      next: d => {
        this.datos = d; this.loading = false;
        this.cobertura = d.totalEstudiantes > 0
          ? Math.round((d.estudiantesConUbicacion / d.totalEstudiantes) * 100) : 0;
        this.ponerMarkers(d.estudiantes || []);
      },
      error: () => this.loading = false
    });
  }

  private ponerMarkers(lista: any[]) {
    if (!this.mapa) return;
    this.markers.forEach(m => m.remove()); this.markers = [];
    if (!lista.length) return;

    // ── Agrupar estudiantes por coordenada exacta ──────────────────────
    // Si dos o más comparten el mismo punto, los distribuimos en espiral
    // para que todos sean visibles. El popup sigue mostrando la coord real.
    const grupos = new Map<string, any[]>();
    lista.forEach(e => {
      const key = `${e.latitud.toFixed(5)},${e.longitud.toFixed(5)}`;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(e);
    });

    const OFFSET_GRADOS = 0.0005; // ~55 metros — suficiente para separar visualmente

    const bounds: any[] = [];

    grupos.forEach(grupo => {
      const total = grupo.length;
      grupo.forEach((e, idx) => {
        // Si hay más de 1 en el mismo punto, calcular posición en círculo
        let lat = e.latitud;
        let lng = e.longitud;

        if (total > 1) {
          const angulo = (2 * Math.PI * idx) / total; // Ángulo equidistante
          lat = e.latitud  + OFFSET_GRADOS * Math.sin(angulo);
          lng = e.longitud + OFFSET_GRADOS * Math.cos(angulo);
        }

        const i = lista.indexOf(e);
        const c = this.COLS[i % this.COLS.length];

        // Pin con inicial del estudiante
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:36px; height:36px;
            border-radius:50% 50% 50% 0;
            background:${c};
            border:3px solid #fff;
            box-shadow:0 4px 14px rgba(0,0,0,.35);
            transform:rotate(-45deg);
            display:flex; align-items:center; justify-content:center;">
              <span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:13px;">${e.nombre.charAt(0)}</span>
          </div>
          ${total > 1 ? `<div style="
            position:absolute; top:-6px; right:-6px;
            width:16px; height:16px; border-radius:50%;
            background:#0F172A; border:2px solid #fff;
            display:flex; align-items:center; justify-content:center;
            font-size:9px; font-weight:800; color:#fff;
            box-shadow:0 2px 4px rgba(0,0,0,.3);">
            ${total}
          </div>` : ''}`,
          iconSize: [36, 36],
          iconAnchor: [18, 36]
        });

        // Línea de conexión al punto real si está desplazado
        if (total > 1) {
          const linea = L.polyline(
            [[e.latitud, e.longitud], [lat, lng]],
            { color: c, weight: 1.5, opacity: 0.5, dashArray: '4 4' }
          ).addTo(this.mapa);
          this.markers.push(linea);
        }

        const m = L.marker([lat, lng], { icon })
          .addTo(this.mapa)
          .bindPopup(`
            <div style="font-family:Inter,sans-serif;padding:4px 2px;min-width:170px;">
              <div style="font-weight:800;font-size:14px;color:#0F172A;margin-bottom:3px;">${e.nombre}</div>
              <div style="font-size:12px;color:#64748B;margin-bottom:8px;">${e.email}</div>
              ${total > 1 ? `<div style="font-size:10px;background:#FEF9C3;color:#92400E;border-radius:5px;padding:2px 7px;margin-bottom:6px;display:inline-block;">
                ⚠️ ${total} estudiantes en la misma ubicación
              </div><br>` : ''}
              <div style="font-size:11px;background:#EFF6FF;color:#2563EB;border-radius:6px;padding:3px 8px;display:inline-block;">
                📍 ${e.latitud.toFixed(5)}, ${e.longitud.toFixed(5)}
              </div>
            </div>
          `, { maxWidth: 240 });

        this.markers.push(m);
        bounds.push([lat, lng]);
      });
    });

    if (bounds.length) {
      setTimeout(() => this.mapa.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 }), 100);
    }
  }


  centrar(e: any) {
    if (!this.mapa) return;
    this.mapa.setView([e.latitud, e.longitud], 16, { animate: true });
    const m = this.markers.find(mk => Math.abs(mk.getLatLng().lat - e.latitud) < .001);
    if (m) m.openPopup();
  }
}
