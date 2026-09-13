import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'mapping/new',
    loadComponent: () =>
      import('./pages/mapping-editor.component').then(
        (m) => m.MappingEditorComponent,
      ),
  },
  {
    path: 'mapping/:id',
    loadComponent: () =>
      import('./pages/mapping-editor.component').then(
        (m) => m.MappingEditorComponent,
      ),
  },
  {
    path: 'sync/:id',
    loadComponent: () =>
      import('./pages/sync-wizard.component').then((m) => m.SyncWizardComponent),
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./pages/history.component').then((m) => m.HistoryComponent),
  },
  {
    path: 'trash',
    loadComponent: () =>
      import('./pages/trash.component').then((m) => m.TrashComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: '' },
];
