// Locale alias maps for classifier signatures.
//
// Signatures (saas, ecommerce, booking, ...) are authored in English. Non-English
// apps (/fr/, /es/, /de/, etc.) classified as "blank" because none of the route
// tokens or element phrases matched. These maps expand every signature entry
// with FR / ES / DE / PT / IT equivalents at scoring time (no mutation of
// signature weights — each entry scores at most once per signature).
//
// Data confirmed 2026-04 against: Qonto, Spendesk, Pennylane, Payfit (FR);
// Holded, Factorial (ES); Mollie, Personio (DE); Conta Azul (PT-BR);
// Fattureincloud (IT); Zalando, OTTO (DE e-commerce); ZARA (ES).
//
// See .planning/VERIFICATION-AUDIT-2026-04-18.md §2.3 for source attribution.

// ---------------------------------------------------------------------------
// Route token aliases — single-token keys matched against snapshot.vocabulary.routes
// ---------------------------------------------------------------------------
//
// The vocab tokenizer splits on [^a-z0-9]+, so a path like /fr/tableau-de-bord
// yields tokens ['fr', 'tableau', 'de', 'bord']. Aliases here are chosen to be
// single surviving tokens (e.g. 'tableau' rather than 'tableau-de-bord') so a
// set-membership check is sufficient.
//
// Accented variants are both listed (e.g. 'uebersicht' + 'ubersicht') because
// URL slugs may or may not strip diacritics and both forms appear in the wild.

export const ROUTE_LOCALE_ALIASES: Record<string, string[]> = {
  // --- SaaS ---
  dashboard: [
    'tableau', 'accueil',                    // FR: tableau-de-bord
    'panel', 'escritorio', 'inicio',         // ES
    'ubersicht', 'uebersicht',               // DE
    'painel',                                // PT
    'cruscotto', 'pannello',                 // IT
  ],
  settings: [
    'parametres', 'reglages', 'preferences', // FR
    'ajustes', 'configuracion',              // ES
    'einstellungen',                         // DE
    'configuracoes', 'definicoes',           // PT-BR / PT
    'impostazioni',                          // IT
  ],
  billing: [
    'facturation',                           // FR
    'facturacion', 'facturas',               // ES
    'abrechnung', 'rechnungen',              // DE
    'cobranca', 'faturamento', 'faturacao',  // PT-BR / PT
    'fatturazione', 'fatture',               // IT
  ],
  subscription: [
    'abonnement',                            // FR + DE (loan)
    'suscripcion',                           // ES
    'mitgliedschaft',                        // DE
    'assinatura',                            // PT
    'abbonamento',                           // IT
  ],
  subscriptions: [
    'abonnements', 'suscripciones', 'abonnements',
    'assinaturas', 'abbonamenti',
  ],
  onboarding: [
    'bienvenue',                             // FR
    'bienvenida', 'bienvenido',              // ES
    'willkommen', 'einrichtung',             // DE
    'benvenuto',                             // IT
  ],
  workspace: [
    'workspace',                             // loanword across all
    'espace',                                // FR: espace-de-travail → 'espace'
    'espacio',                               // ES: espacio-de-trabajo → 'espacio'
    'arbeitsbereich',                        // DE
    'espaco',                                // PT
    'spazio',                                // IT
  ],
  workspaces: ['arbeitsbereiche'],
  team: [
    'equipe',                                // FR + PT-BR
    'equipo',                                // ES
    'equipa',                                // PT
    'squadra',                               // IT
    // DE 'team' is loanword (dominant)
  ],
  teams: ['equipes', 'equipos', 'equipas', 'squadre'],
  members: [
    'membres', 'miembros', 'mitglieder', 'membros', 'membri',
  ],
  invites: [
    'invitations', 'invitar',                // FR / ES
    'einladungen',                           // DE
    'convites',                              // PT
    'inviti',                                // IT
  ],
  integrations: [
    'integraciones', 'integrationen', 'integracoes', 'integrazioni',
  ],
  usage: [
    'utilisation', 'consommation',           // FR
    'uso', 'consumo',                        // ES / PT
    'nutzung', 'verbrauch',                  // DE
    'utilizzo',                              // IT
  ],

  // --- Auth ---
  login: [
    'connexion',                             // FR
    'sesion', 'iniciar', 'entrar', 'acceder',// ES / PT
    'anmelden',                              // DE
    'accedi',                                // IT
  ],
  signin: [
    'connexion', 'anmelden', 'accedi',
  ],
  signup: [
    'inscription', 's-inscrire', 'creer',    // FR
    'registro', 'registrarse', 'alta',       // ES
    'registrieren', 'anmeldung',             // DE
    'cadastro', 'registo', 'criar',          // PT-BR / PT
    'registrati', 'iscriviti',               // IT
  ],
  register: [
    'inscription', 'registro', 'registrieren',
    'cadastro', 'registo', 'registrati',
  ],
  logout: [
    'deconnexion', 'deconnecter',            // FR
    'salir',                                 // ES
    'abmelden', 'ausloggen',                 // DE
    'sair',                                  // PT
    'esci', 'disconnetti',                   // IT
  ],
  'forgot-password': [
    'oublie',                                // FR: mot-de-passe-oublie
    'olvide',                                // ES
    'vergessen',                             // DE
    'esqueci',                               // PT
    'dimenticata',                           // IT
  ],
  'reset-password': [
    'reinitialiser', 'restablecer',
    'zuruecksetzen', 'redefinir', 'ripristina',
  ],
  verify: [
    'verifier', 'verificar', 'bestaetigen', 'verificare',
  ],
  account: [
    'compte',                                // FR: mon-compte → 'compte'
    'cuenta',                                // ES
    'konto',                                 // DE
    'conta',                                 // PT
    // IT uses 'account' (loanword)
  ],
  profile: [
    'profil',                                // FR + DE
    'perfil',                                // ES + PT
    'profilo',                               // IT
  ],
  notifications: [
    'notificaciones', 'avisos',              // ES
    'benachrichtigungen',                    // DE
    'notificacoes',                          // PT
    'notifiche',                             // IT
  ],
  admin: [
    'administration',                        // FR
    'administracion',                        // ES
    'verwaltung',                            // DE
    'administracao',                         // PT
    'amministrazione',                       // IT
  ],
  users: [
    'utilisateurs',                          // FR
    'usuarios',                              // ES + PT
    'benutzer', 'nutzer',                    // DE
    'utenti',                                // IT
  ],
  organization: [
    'organisation',                          // FR + DE
    'organizacion',                          // ES
    'organizacao',                           // PT
    'organizzazione',                        // IT
  ],

  // --- E-commerce ---
  cart: [
    'panier',                                // FR
    'cesta', 'carrito',                      // ES-Spain / ES-LatAm
    'warenkorb',                             // DE
    'carrinho', 'cesto',                     // PT
    'carrello',                              // IT
  ],
  checkout: [
    'commander', 'caisse', 'paiement',       // FR
    'pagar', 'finalizar',                    // ES / PT
    'kasse',                                 // DE
    'cassa', 'pagamento',                    // IT / PT
  ],
  product: [
    'produit', 'article',                    // FR
    'producto', 'articulo',                  // ES
    'produkt', 'artikel',                    // DE
    'produto',                               // PT
    'prodotto', 'articolo',                  // IT
  ],
  products: [
    'produits', 'productos', 'produkte', 'produtos', 'prodotti',
  ],
  category: [
    'categorie',                             // FR
    'categoria',                             // ES + PT + IT
    'kategorie',                             // DE
    'rayon',                                 // FR (dept store)
  ],
  categories: ['categories', 'categorias', 'kategorien'],
  orders: [
    'commandes',                             // FR
    'pedidos',                               // ES + PT
    'bestellungen',                          // DE
    'encomendas',                            // PT
    'ordini',                                // IT
  ],
  order: [
    'commande', 'pedido', 'bestellung', 'encomenda', 'ordine',
  ],
  shop: [
    'boutique', 'tienda', 'loja', 'negozio',
    // DE 'shop' is loanword
  ],
  store: [
    'boutique', 'tienda', 'laden', 'loja', 'negozio',
  ],
  collection: ['collection', 'coleccion', 'kollektion', 'colecao', 'collezione'],
  collections: ['collections', 'colecciones', 'kollektionen', 'colecoes', 'collezioni'],
  wishlist: [
    'favoris',                               // FR
    'favoritos',                             // ES + PT
    'wunschliste', 'favoriten', 'merkliste', // DE
    'preferiti', 'desideri',                 // IT
    'desejos',                               // PT
  ],

  // --- Booking ---
  booking: [
    'reservation', 'reserva', 'buchung', 'prenotazione',
  ],
  bookings: ['reservations', 'reservas', 'buchungen', 'prenotazioni'],
  book: [
    'reserver',                              // FR (also a verb)
    'reservar',                              // ES + PT
    'buchen',                                // DE
    'prenota', 'prenotare',                  // IT
  ],
  reserve: [
    'reserver', 'reservar', 'buchen', 'prenota',
  ],
  reservation: [
    'reservation', 'reserva', 'reservierung', 'prenotazione',
  ],
  reservations: [
    'reservations', 'reservas', 'reservierungen', 'prenotazioni',
  ],
  availability: [
    'disponibilites', 'disponibilite',       // FR
    'disponibilidad', 'horarios',            // ES
    'verfuegbarkeit', 'verfugbarkeit', 'termine', // DE
    'disponibilidade',                       // PT
    'disponibilita', 'orari',                // IT
  ],
  appointment: [
    'rendez-vous', 'rdv',                    // FR (hyphenated; 'rendez' + 'vous' tokens)
    'rendez', 'vous',                        // tokenized forms
    'cita',                                  // ES
    'termin',                                // DE
    'agendamento', 'marcacao',               // PT-BR / PT
    'appuntamento',                          // IT
  ],
  appointments: [
    'citas', 'termine', 'agendamentos', 'marcacoes', 'appuntamenti',
  ],
  schedule: [
    'horaire', 'agenda', 'terminplan', 'agenda',
    'calendario',
  ],
  calendar: ['calendrier', 'agenda', 'kalender', 'calendario'],

  // --- Content ---
  articles: ['articles', 'articulos', 'artikel', 'artigos', 'articoli'],
  article: ['article', 'articulo', 'artikel', 'artigo', 'articolo'],
  post: ['publicacion', 'beitrag', 'postagem', 'articolo'],
  posts: ['publicaciones', 'beitraege', 'postagens'],
  author: ['auteur', 'autor', 'autor', 'autore'],
  authors: ['auteurs', 'autores', 'autoren', 'autori'],
  tag: ['etiquette', 'etiqueta', 'tag', 'etichetta'],
  tags: ['etiquettes', 'etiquetas', 'etichette'],
  topic: ['sujet', 'tema', 'thema', 'argomento'],
  topics: ['sujets', 'temas', 'themen', 'argomenti'],
  newsletter: ['bulletin', 'boletin', 'newsletter', 'newsletter'],
  search: ['recherche', 'busqueda', 'busca', 'pesquisa', 'suche', 'ricerca'],

  // --- Marketing ---
  pricing: [
    'tarifs', 'prix',                        // FR
    'precios', 'tarifa', 'planes',           // ES
    'preise', 'tarif',                       // DE
    'precos', 'planos',                      // PT
    'prezzi', 'costo', 'piani',              // IT
  ],
  features: [
    'fonctionnalites',                       // FR
    'funcionalidades', 'caracteristicas',    // ES + PT
    'funktionen',                            // DE
    'funzionalita', 'caratteristiche',       // IT
  ],
  about: [
    'apropos', 'propos',                     // FR: a-propos
    'sobre', 'nosotros',                     // ES + PT
    'uber', 'ueber',                         // DE
    'chisiamo',                              // IT (chi-siamo → one token after dedash)
  ],
  contact: ['contact', 'contacto', 'kontakt', 'contato', 'contatto', 'contatti'],
  faq: ['faq'], // universal
  testimonials: ['temoignages', 'testimonios', 'stimmen', 'depoimentos', 'testimonianze'],
  customers: ['clients', 'clientes', 'kunden', 'clienti'],
  careers: ['carrieres', 'empleo', 'karriere', 'carreiras', 'lavora'],
  'case-studies': ['etudes', 'casos', 'fallstudien', 'casi'],
  demo: ['demo'], // universal
  'get-started': [
    'commencer',                             // FR
    'empezar', 'comenzar',                   // ES
    'starten', 'loslegen',                   // DE
    'comecar', 'iniciar',                    // PT
    'inizia', 'iniziare',                    // IT
  ],

  // --- Admin ---
  roles: ['roles', 'roles', 'rollen', 'papeis', 'ruoli'],
  permissions: ['permissions', 'permisos', 'berechtigungen', 'permissoes', 'permessi'],
  audit: ['audit', 'auditoria', 'pruefung', 'auditoria', 'verifica'],
  logs: ['journaux', 'registros', 'protokolle', 'registros', 'registri'],
  reports: ['rapports', 'informes', 'berichte', 'relatorios', 'rapporti'],
  moderation: ['moderation', 'moderacion', 'moderation', 'moderacao', 'moderazione'],

  // --- Social ---
  feed: ['flux'],
  friends: ['amis', 'amigos', 'freunde', 'amici'],
  messages: ['messages', 'mensajes', 'nachrichten', 'mensagens', 'messaggi'],
  message: ['message', 'mensaje', 'nachricht', 'mensagem', 'messaggio'],
  chat: ['chat', 'chat', 'chat', 'chat', 'chat'],
  comments: ['commentaires', 'comentarios', 'kommentare', 'comentarios', 'commenti'],
  likes: ['likes', 'megusta', 'likes', 'curtidas', 'likes'],
  explore: ['explorer', 'explorar', 'erkunden', 'explorar', 'esplora'],

  // --- CRM ---
  contacts: ['contacts', 'contactos', 'kontakte', 'contatos', 'contatti'],
  leads: ['prospects', 'leads', 'leads', 'leads', 'leads'],
  deals: ['affaires', 'negocios', 'deals', 'negocios', 'affari'],
  pipeline: ['pipeline', 'tuberia', 'pipeline', 'pipeline', 'pipeline'],
  opportunities: ['opportunites', 'oportunidades', 'chancen', 'oportunidades', 'opportunita'],
  tasks: ['taches', 'tareas', 'aufgaben', 'tarefas', 'compiti'],
  activities: ['activites', 'actividades', 'aktivitaeten', 'atividades', 'attivita'],
};

// Clean up: remove any empty-alias entries so we don't iterate noise.
for (const key of Object.keys(ROUTE_LOCALE_ALIASES)) {
  const cleaned = ROUTE_LOCALE_ALIASES[key].filter((a) => a && a.length > 1);
  if (cleaned.length === 0) {
    delete ROUTE_LOCALE_ALIASES[key];
  } else {
    ROUTE_LOCALE_ALIASES[key] = Array.from(new Set(cleaned));
  }
}

// ---------------------------------------------------------------------------
// Element phrase aliases — matched against snapshot.vocabulary.elements
// ---------------------------------------------------------------------------
//
// The classifier tokenizes each phrase on scoring and checks all-tokens-present.
// Aliases are phrases (multi-token ok) — provide them in their natural form.

export const ELEMENT_LOCALE_ALIASES: Record<string, string[]> = {
  'sign in': [
    'se connecter', 'connexion',
    'iniciar sesion', 'entrar',
    'anmelden', 'einloggen',
    'accedi',
  ],
  'log in': [
    'connexion', 'se connecter',
    'iniciar sesion', 'acceder',
    'anmelden', 'einloggen',
    'accedi', 'login',
  ],
  'sign up': [
    'inscription', 's inscrire', 'creer un compte',
    'registrarse', 'crear cuenta', 'darse de alta',
    'registrieren', 'konto erstellen',
    'cadastrar', 'criar conta',
    'registrati', 'iscriviti',
  ],
  register: [
    'inscription', 'registro', 'registrieren',
    'cadastro', 'registrati',
  ],
  'create account': [
    'creer un compte', 'crear cuenta', 'konto erstellen',
    'criar conta', 'crea account',
  ],
  'forgot password': [
    'mot de passe oublie',
    'olvide mi contrasena', 'contrasena olvidada',
    'passwort vergessen',
    'esqueci minha senha',
    'password dimenticata',
  ],
  'reset password': [
    'reinitialiser le mot de passe',
    'restablecer contrasena',
    'passwort zuruecksetzen',
    'redefinir senha',
    'reimposta password',
  ],

  // --- SaaS ---
  'invite team': [
    'inviter equipe', 'invitar equipo', 'team einladen',
    'convidar equipe', 'invita team',
  ],
  'create workspace': [
    'creer espace', 'crear espacio', 'arbeitsbereich erstellen',
    'criar espaco', 'crea spazio',
  ],
  'upgrade plan': [
    'mettre a niveau', 'passer au plan superieur',
    'mejorar plan', 'actualizar plan',
    'plan upgraden', 'tarif wechseln',
    'fazer upgrade', 'atualizar plano',
    'aggiorna piano', 'passa a',
  ],
  'start trial': [
    'commencer essai', 'essai gratuit',
    'iniciar prueba', 'prueba gratis',
    'testversion starten', 'kostenlos testen',
    'comecar teste', 'teste gratis',
    'inizia prova', 'prova gratuita',
  ],
  'connect integration': [
    'connecter integration', 'conectar integracion',
    'integration verbinden', 'conectar integracao',
    'connetti integrazione',
  ],
  'api key': [
    'cle api', 'clave api', 'api schluessel',
    'chave api', 'chiave api',
  ],
  'manage billing': [
    'gerer facturation', 'gestionar facturacion',
    'abrechnung verwalten', 'gerenciar cobranca',
    'gestisci fatturazione',
  ],

  // --- E-commerce ---
  'add to cart': [
    'ajouter au panier',
    'anadir a la cesta', 'anadir al carrito', 'agregar al carrito',
    'in den warenkorb', 'zum warenkorb hinzufuegen',
    'adicionar ao carrinho',
    'aggiungi al carrello',
  ],
  'add to bag': [
    'ajouter au sac', 'anadir a la bolsa', 'zur tasche',
  ],
  'buy now': [
    'acheter maintenant',
    'comprar ahora',
    'jetzt kaufen',
    'comprar agora',
    'compra ora', 'acquista ora',
  ],
  checkout: [
    'commander', 'passer commande',
    'finalizar compra', 'pagar',
    'zur kasse', 'kasse',
    'finalizar compra',
    'vai alla cassa', 'procedi al checkout',
  ],
  'place order': [
    'passer la commande',
    'realizar pedido',
    'bestellung aufgeben',
    'fazer pedido',
    'effettua ordine',
  ],
  'in stock': [
    'en stock',
    'en stock', 'disponible',
    'auf lager',
    'em estoque',
    'disponibile',
  ],

  // --- Booking ---
  'book now': [
    'reserver maintenant',
    'reservar ahora',
    'jetzt buchen',
    'reservar agora',
    'prenota ora',
  ],
  'reserve now': [
    'reserver maintenant', 'reservar ahora', 'jetzt reservieren',
    'reservar agora', 'prenota ora',
  ],
  'check in': [
    'arrivee', 'check in',
    'entrada', 'registrarse',
    'check in', 'anreise',
    'entrada',
    'check in',
  ],
  'check out': [
    'depart', 'check out',
    'salida',
    'abreise', 'check out',
    'saida',
    'check out',
  ],
  'select dates': [
    'selectionner les dates', 'choisir dates',
    'seleccionar fechas', 'elegir fechas',
    'daten auswaehlen', 'datum waehlen',
    'selecionar datas', 'escolher datas',
    'seleziona date', 'scegli date',
  ],
  'confirm booking': [
    'confirmer reservation',
    'confirmar reserva',
    'buchung bestaetigen',
    'confirmar reserva',
    'conferma prenotazione',
  ],
  'per night': [
    'par nuit', 'por noche', 'pro nacht', 'por noite', 'a notte',
  ],
  guests: [
    'invites', 'voyageurs',
    'huespedes',
    'gaeste',
    'hospedes',
    'ospiti',
  ],

  // --- Marketing ---
  'get started': [
    'commencer', 'demarrer',
    'empezar', 'comenzar',
    'loslegen', 'jetzt starten',
    'comecar', 'iniciar',
    'inizia', 'iniziare',
  ],
  'request demo': [
    'demander demo',
    'solicitar demo',
    'demo anfragen',
    'solicitar demonstracao',
    'richiedi demo',
  ],
  'book a demo': [
    'reserver demo',
    'reservar demo',
    'demo buchen',
    'agendar demo',
    'prenota demo',
  ],
  'contact sales': [
    'contacter ventes', 'contacter commercial',
    'contactar ventas',
    'vertrieb kontaktieren',
    'contato vendas', 'contactar vendas',
    'contatta vendite',
  ],
  'start free trial': [
    'commencer essai gratuit',
    'iniciar prueba gratis',
    'kostenlos testen',
    'teste gratis',
    'prova gratuita',
  ],
  'see pricing': [
    'voir tarifs',
    'ver precios',
    'preise ansehen',
    'ver precos',
    'vedi prezzi',
  ],

  // --- Social ---
  'send message': [
    'envoyer message',
    'enviar mensaje',
    'nachricht senden',
    'enviar mensagem',
    'invia messaggio',
  ],
  'add friend': [
    'ajouter ami',
    'anadir amigo', 'agregar amigo',
    'freund hinzufuegen',
    'adicionar amigo',
    'aggiungi amico',
  ],

  // --- Admin ---
  'edit row': [
    'modifier ligne', 'editar fila', 'zeile bearbeiten',
    'editar linha', 'modifica riga',
  ],
  'delete row': [
    'supprimer ligne', 'eliminar fila', 'zeile loeschen',
    'excluir linha', 'elimina riga',
  ],
  'export csv': [
    'exporter csv', 'exportar csv', 'csv exportieren',
    'exportar csv', 'esporta csv',
  ],
  'bulk actions': [
    'actions groupees',
    'acciones en masa',
    'massenaktionen',
    'acoes em massa',
    'azioni in blocco',
  ],
  'assign role': [
    'attribuer role', 'asignar rol', 'rolle zuweisen',
    'atribuir papel', 'assegna ruolo',
  ],
};

// Clean duplicate aliases
for (const key of Object.keys(ELEMENT_LOCALE_ALIASES)) {
  ELEMENT_LOCALE_ALIASES[key] = Array.from(new Set(ELEMENT_LOCALE_ALIASES[key]));
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Returns all tokens that should match a given English route signature key,
 * including the English key itself.
 */
export function getRouteMatchTokens(englishKey: string): string[] {
  const aliases = ROUTE_LOCALE_ALIASES[englishKey];
  if (!aliases || aliases.length === 0) return [englishKey];
  return [englishKey, ...aliases];
}

/**
 * Returns all phrases that should match a given English element signature key,
 * including the English key itself.
 */
export function getElementMatchPhrases(englishKey: string): string[] {
  const aliases = ELEMENT_LOCALE_ALIASES[englishKey];
  if (!aliases || aliases.length === 0) return [englishKey];
  return [englishKey, ...aliases];
}
