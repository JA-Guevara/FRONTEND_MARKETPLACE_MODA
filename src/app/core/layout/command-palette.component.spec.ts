import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandPaletteComponent } from './command-palette.component';
import { CommandPaletteService } from './admin-topbar.component';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { PlataformaApi } from '../../../features/plataforma-saas/infrastructure/plataforma.api';

describe('CommandPaletteComponent', () => {
  let fixture: ComponentFixture<CommandPaletteComponent>;
  let component: CommandPaletteComponent;
  let cmdService: CommandPaletteService;
  let router: Router;
  let mockApi: {
    tenants: ReturnType<typeof vi.fn>;
    users: ReturnType<typeof vi.fn>;
  };
  let mockSession: {
    scope: ReturnType<typeof signal<'platform' | 'tenant'>>;
    isSupport: ReturnType<typeof signal<boolean>>;
    can: (p?: string) => boolean;
  };

  beforeEach(async () => {
    mockApi = {
      tenants: vi.fn().mockReturnValue(of({ items: [], total: 0 })),
      users: vi.fn().mockReturnValue(of({ items: [], total: 0 })),
    };

    mockSession = {
      scope: signal<'platform' | 'tenant'>('platform'),
      isSupport: signal(false),
      can: () => true,
    };

    await TestBed.configureTestingModule({
      imports: [CommandPaletteComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        CommandPaletteService,
        { provide: PlataformaApi, useValue: mockApi },
        { provide: SessionService, useValue: mockSession },
      ],
    }).compileComponents();

    cmdService = TestBed.inject(CommandPaletteService);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(CommandPaletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('Ctrl+K abre y enfoca el campo; Esc cierra', async () => {
    expect(component.isOpen()).toBe(false);

    // Press Ctrl+K
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isOpen()).toBe(true);

    // Press Esc
    const dialog = fixture.nativeElement.querySelector('.cmd') as HTMLElement;
    expect(dialog).not.toBeNull();

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isOpen()).toBe(false);
  });

  it('Escribir «audi» muestra «Auditoría global» y Enter navega', async () => {
    component.open();
    fixture.detectChanges();

    component.onQueryChange('audi');
    fixture.detectChanges();

    const results = component.navResults();
    expect(results.some((r) => r.label.includes('Auditoría global'))).toBe(true);

    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const dialog = fixture.nativeElement.querySelector('.cmd') as HTMLElement;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(navigateSpy).toHaveBeenCalledWith('/admin/plataforma/auditoria');
    expect(component.isOpen()).toBe(false);
  });

  it('En scope tenant no busca empresas', async () => {
    mockSession.scope.set('tenant');
    component.open();
    fixture.detectChanges();

    component.onQueryChange('urbano');
    fixture.detectChanges();

    // Since scope is tenant, it should NOT query plataformaApi.tenants
    expect(mockApi.tenants).not.toHaveBeenCalled();
    expect(component.tenantsFound().length).toBe(0);
  });
});
