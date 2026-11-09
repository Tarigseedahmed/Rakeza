const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function openDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'rakeza.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      email TEXT NOT NULL COLLATE NOCASE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','hr','manager','viewer')),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id,email)
    );
    CREATE TABLE IF NOT EXISTS organization_preferences (
      organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      country_code TEXT NOT NULL DEFAULT 'SA',
      currency_code TEXT NOT NULL DEFAULT 'SAR',
      locale TEXT NOT NULL DEFAULT 'ar-SA',
      timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
      date_format TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
      week_start INTEGER NOT NULL DEFAULT 0 CHECK(week_start BETWEEN 0 AND 6),
      weekend_days TEXT NOT NULL DEFAULT '[5,6]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role_key TEXT NOT NULL CHECK(role_key IN ('admin','hr','manager','viewer')),
      module_key TEXT NOT NULL,
      action_key TEXT NOT NULL CHECK(action_key IN ('read','create','update','delete','export')),
      enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(organization_id,role_key,module_key,action_key)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      employee_number TEXT NOT NULL,
      full_name TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id,employee_number)
    );
    CREATE TABLE IF NOT EXISTS employee_documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      document_number TEXT NOT NULL,
      issued_on TEXT,
      expires_on TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(issued_on IS NULL OR expires_on >= issued_on)
    );
    CREATE TABLE IF NOT EXISTS organization_documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      title TEXT NOT NULL,
      document_type TEXT NOT NULL,
      document_number TEXT NOT NULL,
      issuing_authority TEXT,
      issued_on TEXT,
      expires_on TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(issued_on IS NULL OR expires_on >= issued_on)
    );
    CREATE TABLE IF NOT EXISTS app_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      module TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      employee_document_id TEXT REFERENCES employee_documents(id) ON DELETE CASCADE,
      organization_document_id TEXT REFERENCES organization_documents(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL CHECK(byte_size > 0),
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(employee_document_id IS NULL OR organization_document_id IS NULL)
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      actor_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT NOT NULL DEFAULT '{}',
      occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS employees_org_name_idx ON employees(organization_id,full_name);
    CREATE INDEX IF NOT EXISTS employee_documents_owner_idx ON employee_documents(organization_id,employee_id,expires_on);
    CREATE INDEX IF NOT EXISTS employee_documents_expiry_idx ON employee_documents(organization_id,expires_on);
    CREATE INDEX IF NOT EXISTS organization_documents_expiry_idx ON organization_documents(organization_id,expires_on);
    CREATE INDEX IF NOT EXISTS app_records_module_idx ON app_records(organization_id,module,updated_at DESC);
    CREATE INDEX IF NOT EXISTS app_records_module_page_idx ON app_records(organization_id,module,updated_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS audit_org_time_idx ON audit_events(organization_id,occurred_at DESC);
  `);
  const modules=['employees','attendance','absence','leaves','payroll','advances','contracts','files','reports','companyDocs','employeeDocs'];
  const actions=['read','create','update','delete','export'];
  const defaults={
    admin:new Set(modules.flatMap(module=>actions.map(action=>`${module}:${action}`))),
    hr:new Set(modules.filter(module=>!['payroll','advances'].includes(module)).flatMap(module=>actions.map(action=>`${module}:${action}`))),
    manager:new Set(modules.filter(module=>!['payroll','advances'].includes(module)).flatMap(module=>['read','create','update','export'].map(action=>`${module}:${action}`))),
    viewer:new Set(['employees','attendance','absence','leaves','reports'].flatMap(module=>['read','export'].map(action=>`${module}:${action}`))),
  };
  const preferenceInsert=db.prepare('INSERT OR IGNORE INTO organization_preferences(organization_id) VALUES(?)');
  const permissionInsert=db.prepare('INSERT OR IGNORE INTO role_permissions(organization_id,role_key,module_key,action_key,enabled) VALUES(?,?,?,?,?)');
  const ensureDefaults=db.transaction(organizationId=>{
    preferenceInsert.run(organizationId);
    for(const [role,permissions] of Object.entries(defaults))for(const module of modules)for(const action of actions){
      permissionInsert.run(organizationId,role,module,action,permissions.has(`${module}:${action}`)?1:0);
    }
  });
  for(const organization of db.prepare('SELECT id FROM organizations').all())ensureDefaults(organization.id);
  return db;
}

module.exports = { openDatabase };
