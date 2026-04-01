/**
 * Internationalization Foundation
 *
 * Simple key-based translation system.
 * Default: English. Supported: Spanish (es).
 * Translates UI labels only (AI responses remain English).
 */

// ── Translation Tables ───────────────────────────────────────

const translations: Readonly<Record<string, Record<string, string>>> = {
  en: {
    // Navigation - main
    'nav.dashboard': 'Dashboard',
    'nav.chat': 'Chat',
    'nav.workspaces': 'Workspaces',
    'nav.assistant': 'Assistant',
    // Navigation - intelligence
    'nav.reports': 'Reports',
    'nav.dashboards': 'Dashboards',
    'nav.analytics': 'Analytics',
    'nav.automations': 'Automations',
    'nav.shared': 'Shared',
    'nav.search': 'Search',
    'nav.history': 'History',
    // Navigation - data
    'nav.documents': 'Documents',
    'nav.glossary': 'Glossary',
    'nav.sources': 'Data Sources',
    'nav.api_docs': 'API Docs',
    // Navigation - admin
    'nav.admin': 'Admin',
    'nav.integrations': 'Integrations',
    // Navigation - account
    'nav.settings': 'Settings',
    // Navigation group labels
    'group.intelligence': 'Intelligence',
    'group.data': 'Data',
    'group.admin': 'System',
    'group.account': 'Account',
    // Common UI
    'ui.new_chat': 'New Chat',
    'ui.sign_out': 'Sign Out',
    'ui.search_placeholder': 'Search chats...',
    'ui.loading': 'Loading...',
    'ui.no_results': 'No results found',
    'ui.save': 'Save',
    'ui.cancel': 'Cancel',
    'ui.delete': 'Delete',
    'ui.confirm': 'Confirm',
    'ui.notifications': 'Notifications',
    'ui.mark_all_read': 'Mark all read',
    'ui.no_notifications': 'No notifications',
    // Embed
    'embed.powered_by': 'Powered by',
    'embed.send': 'Send',
    'embed.type_message': 'Type a message...',
    // API Docs
    'api.title': 'API Documentation',
    'api.try_it': 'Try it',
    'api.response': 'Response',
    'api.request': 'Request',
  },
  es: {
    // Navigation - main
    'nav.dashboard': 'Tablero',
    'nav.chat': 'Chat',
    'nav.workspaces': 'Espacios de Trabajo',
    'nav.assistant': 'Asistente',
    // Navigation - intelligence
    'nav.reports': 'Informes',
    'nav.dashboards': 'Paneles',
    'nav.analytics': 'Analitica',
    'nav.automations': 'Automatizaciones',
    'nav.shared': 'Compartido',
    'nav.search': 'Buscar',
    'nav.history': 'Historial',
    // Navigation - data
    'nav.documents': 'Documentos',
    'nav.glossary': 'Glosario',
    'nav.sources': 'Fuentes de Datos',
    'nav.api_docs': 'Docs API',
    // Navigation - admin
    'nav.admin': 'Administracion',
    'nav.integrations': 'Integraciones',
    // Navigation - account
    'nav.settings': 'Configuracion',
    // Navigation group labels
    'group.intelligence': 'Inteligencia',
    'group.data': 'Datos',
    'group.admin': 'Sistema',
    'group.account': 'Cuenta',
    // Common UI
    'ui.new_chat': 'Nuevo Chat',
    'ui.sign_out': 'Cerrar Sesion',
    'ui.search_placeholder': 'Buscar chats...',
    'ui.loading': 'Cargando...',
    'ui.no_results': 'Sin resultados',
    'ui.save': 'Guardar',
    'ui.cancel': 'Cancelar',
    'ui.delete': 'Eliminar',
    'ui.confirm': 'Confirmar',
    'ui.notifications': 'Notificaciones',
    'ui.mark_all_read': 'Marcar todo leido',
    'ui.no_notifications': 'Sin notificaciones',
    // Embed
    'embed.powered_by': 'Impulsado por',
    'embed.send': 'Enviar',
    'embed.type_message': 'Escribe un mensaje...',
    // API Docs
    'api.title': 'Documentacion de API',
    'api.try_it': 'Probar',
    'api.response': 'Respuesta',
    'api.request': 'Solicitud',
  },
};

// ── Public API ────────────────────────────────────────────────

export function t(key: string, lang?: string): string {
  const locale = lang ?? 'en';
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}

export function getSupportedLocales(): string[] {
  return Object.keys(translations);
}

export function getTranslations(lang: string): Record<string, string> {
  return { ...translations[lang ?? 'en'] };
}
