const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const express = require('express');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const { openDatabase } = require('./database.cjs');
const saudiRegulations = require('./regulations/saudi.cjs');
const uaeRegulations = require('./regulations/uae.cjs');
const bahrainRegulations = require('./regulations/bahrain.cjs');
const kuwaitRegulations = require('./regulations/kuwait.cjs');
const omanRegulations = require('./regulations/oman.cjs');
const egyptRegulations = require('./regulations/egypt.cjs');
const jordanRegulations = require('./regulations/jordan.cjs');
const iraqRegulations = require('./regulations/iraq.cjs');
const moroccoRegulations = require('./regulations/morocco.cjs');
const regulationsByCountry={SA:saudiRegulations,AE:uaeRegulations,BH:bahrainRegulations,KW:kuwaitRegulations,OM:omanRegulations,EG:egyptRegulations,JO:jordanRegulations,IQ:iraqRegulations,MA:moroccoRegulations};

const dataDir = process.env.RAKEZA_DATA_DIR || path.join(os.homedir(), 'AppData', 'Local', 'Rakeza HR', 'data');
const documentDir = path.join(dataDir, 'documents');
const backupDir = path.join(dataDir, 'backups');
fs.mkdirSync(documentDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });
const db = openDatabase(dataDir);
const app = express();
const allowedModules = new Set(['employees','attendance','absence','leaves','payroll','advances','contracts','files','reports']);
const documentModules = new Set(['employeeDocs','companyDocs']);
const permissionModules = [...allowedModules,...documentModules];
const permissionActions = ['read','create','update','delete','export'];
const roles = ['admin','hr','manager','viewer'];
const countryProfiles = [
  {code:'SA',nameAr:'السعودية',nameEn:'Saudi Arabia',currency:'SAR',locale:'ar-SA',timezone:'Asia/Riyadh',dateFormat:'dd/MM/yyyy',weekStart:0,weekendDays:[5,6]},
  {code:'AE',nameAr:'الإمارات العربية المتحدة',nameEn:'United Arab Emirates',currency:'AED',locale:'ar-AE',timezone:'Asia/Dubai',dateFormat:'dd/MM/yyyy',weekStart:1,weekendDays:[6,0]},
  {code:'BH',nameAr:'البحرين',nameEn:'Bahrain',currency:'BHD',locale:'ar-BH',timezone:'Asia/Bahrain',dateFormat:'dd/MM/yyyy',weekStart:0,weekendDays:[5,6]},
  {code:'KW',nameAr:'الكويت',nameEn:'Kuwait',currency:'KWD',locale:'ar-KW',timezone:'Asia/Kuwait',dateFormat:'dd/MM/yyyy',weekStart:0,weekendDays:[5,6]},
  {code:'QA',nameAr:'قطر',nameEn:'Qatar',currency:'QAR',locale:'ar-QA',timezone:'Asia/Qatar',dateFormat:'dd/MM/yyyy',weekStart:0,weekendDays:[5,6]},
  {code:'OM',nameAr:'عُمان',nameEn:'Oman',currency:'OMR',locale:'ar-OM',timezone:'Asia/Muscat',dateFormat:'dd/MM/yyyy',weekStart:0,weekendDays:[5,6]},
  {code:'EG',nameAr:'مصر',nameEn:'Egypt',currency:'EGP',locale:'ar-EG',timezone:'Africa/Cairo',dateFormat:'dd/MM/yyyy',weekStart:6,weekendDays:[5,6]},
  {code:'JO',nameAr:'الأردن',nameEn:'Jordan',currency:'JOD',locale:'ar-JO',timezone:'Asia/Amman',dateFormat:'dd/MM/yyyy',weekStart:0,weekendDays:[5,6]},
  {code:'IQ',nameAr:'العراق',nameEn:'Iraq',currency:'IQD',locale:'ar-IQ',timezone:'Asia/Baghdad',dateFormat:'dd/MM/yyyy',weekStart:0,weekendDays:[5,6]},
  {code:'MA',nameAr:'المغرب',nameEn:'Morocco',currency:'MAD',locale:'ar-MA',timezone:'Africa/Casablanca',dateFormat:'dd/MM/yyyy',weekStart:1,weekendDays:[6,0]},
  {code:'DZ',nameAr:'الجزائر',nameEn:'Algeria',currency:'DZD',locale:'ar-DZ',timezone:'Africa/Algiers',dateFormat:'dd/MM/yyyy',weekStart:0,weekendDays:[5,6]},
  {code:'TN',nameAr:'تونس',nameEn:'Tunisia',currency:'TND',locale:'ar-TN',timezone:'Africa/Tunis',dateFormat:'dd/MM/yyyy',weekStart:1,weekendDays:[6,0]},
];

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use((req,res,next)=>{
  const origin=req.headers.origin;
  if(origin && (origin==='null'||origin==='http://localhost:5173'||origin==='http://127.0.0.1:5173'||origin==='app://rakeza')){
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  }
  if(req.method==='OPTIONS')return res.sendStatus(204);next();
});
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, limit: 10, standardHeaders: true, legacyHeaders: false }));

function hashToken(token){return crypto.createHash('sha256').update(token).digest('hex');}
function audit(user,action,entityType,entityId,details={}){
  db.prepare('INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)')
    .run(user.organization_id,user.id,action,entityType,entityId||null,JSON.stringify(details));
}
function requireAuth(req,res,next){
  const token=(req.headers.authorization||'').startsWith('Bearer ')?req.headers.authorization.slice(7):'';
  if(!token)return res.status(401).json({code:'UNAUTHENTICATED',message:'Authentication required'});
  const session=db.prepare(`SELECT u.id,u.organization_id,u.email,u.full_name,u.role,u.is_active,s.id AS session_id
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND datetime(s.expires_at)>CURRENT_TIMESTAMP`).get(hashToken(token));
  if(!session||!session.is_active)return res.status(401).json({code:'SESSION_EXPIRED',message:'Session expired'});
  req.user=session;req.sessionTokenHash=hashToken(token);next();
}
function requireRole(...roles){return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({code:'FORBIDDEN',message:'You do not have permission for this action'});}
function hasPermission(user,module,action){if(user.role==='admin')return true;return !!db.prepare('SELECT enabled FROM role_permissions WHERE organization_id=? AND role_key=? AND module_key=? AND action_key=?').get(user.organization_id,user.role,module,action)?.enabled;}
function getRolePermissions(organizationId,role){return Object.fromEntries(permissionModules.map(module=>[module,Object.fromEntries(permissionActions.map(action=>[action,role==='admin'||!!db.prepare('SELECT enabled FROM role_permissions WHERE organization_id=? AND role_key=? AND module_key=? AND action_key=?').get(organizationId,role,module,action)?.enabled]))]));}
function requirePermission(module,action){return (req,res,next)=>{
  const moduleKey=typeof module==='function'?module(req):module;
  try{return hasPermission(req.user,moduleKey,action)?next():res.status(403).json({code:'FORBIDDEN',message:'Your role does not have permission to perform this action'});}catch(error){return logSafeError(res,error);}
};}
function requireAnyPermission(moduleKeys,action){return (req,res,next)=>{if(req.user.role==='admin')return next();const placeholders=moduleKeys.map(()=>'?').join(',');try{const result=db.prepare(`SELECT 1 FROM role_permissions WHERE organization_id=? AND role_key=? AND action_key=? AND enabled=1 AND module_key IN (${placeholders}) LIMIT 1`).get(req.user.organization_id,req.user.role,action,...moduleKeys);return result?next():res.status(403).json({code:'FORBIDDEN',message:'Your role does not have permission to perform this action'});}catch(error){return logSafeError(res,error);}};}
function requireAttachmentPermission(action){return (req,res,next)=>{if(req.user.role==='admin')return next();try{let moduleKey=req.params.module;if(!moduleKey){const item=db.prepare('SELECT employee_document_id,organization_document_id FROM attachments WHERE id=? AND organization_id=?').get(req.params.id,req.user.organization_id);if(!item)return res.status(404).json({code:'NOT_FOUND',message:'Attachment not found'});moduleKey=item.employee_document_id?'employeeDocs':'companyDocs';}return requirePermission(moduleKey,action)(req,res,next);}catch(error){return logSafeError(res,error);}};}
function logSafeError(res,error){console.error(error);return res.status(500).json({code:'INTERNAL_ERROR',message:'The request could not be completed'});}
function parsePayload(value){try{return JSON.parse(value||'{}');}catch{return {};}}
function initializeOrganizationDefaults(organizationId){
  db.prepare('INSERT OR IGNORE INTO organization_preferences(organization_id) VALUES(?)').run(organizationId);
  const defaults={
    admin:new Set(permissionModules.flatMap(module=>permissionActions.map(action=>`${module}:${action}`))),
    hr:new Set(permissionModules.filter(module=>!['payroll','advances'].includes(module)).flatMap(module=>permissionActions.map(action=>`${module}:${action}`))),
    manager:new Set(permissionModules.filter(module=>!['payroll','advances'].includes(module)).flatMap(module=>['read','create','update','export'].map(action=>`${module}:${action}`))),
    viewer:new Set(['employees','attendance','absence','leaves','reports'].flatMap(module=>['read','export'].map(action=>`${module}:${action}`))),
  };
  const add=db.prepare('INSERT OR IGNORE INTO role_permissions(organization_id,role_key,module_key,action_key,enabled) VALUES(?,?,?,?,?)');
  for(const role of roles)for(const module of permissionModules)for(const action of permissionActions)add.run(organizationId,role,module,action,defaults[role].has(`${module}:${action}`)?1:0);
}
function findModulePage(orgId,module,{q='',status='',limit=50,offset=0}={}){
  const conditions=[];const values=[];const needle=q?`%${q}%`:'';
  if(module==='employees'){
    conditions.push('organization_id=?');values.push(orgId);
    if(q){conditions.push('(full_name LIKE ? OR employee_number LIKE ?)');values.push(needle,needle);}
    if(status){conditions.push("json_extract(payload,'$.status')=?");values.push(status);}
    const where=conditions.join(' AND ');const total=db.prepare(`SELECT COUNT(*) AS total FROM employees WHERE ${where}`).get(...values).total;
    const items=db.prepare(`SELECT id,payload FROM employees WHERE ${where} ORDER BY full_name,id LIMIT ? OFFSET ?`).all(...values,limit,offset).map(r=>({...parsePayload(r.payload),id:r.id}));
    return {items,total};
  }
  if(module==='employeeDocs'||module==='companyDocs'){
    const employee=module==='employeeDocs';const alias=employee?'d':'d';
    const from=employee?'employee_documents d JOIN employees e ON e.id=d.employee_id':'organization_documents d';
    conditions.push('d.organization_id=?');values.push(orgId);
    if(q){conditions.push(employee?'(d.payload LIKE ? OR e.full_name LIKE ? OR e.employee_number LIKE ?)':'(d.payload LIKE ?)');values.push(...(employee?[needle,needle,needle]:[needle]));}
    if(status==='expired')conditions.push("d.expires_on < date('now')");
    else if(status==='expiring')conditions.push("d.expires_on BETWEEN date('now') AND date('now','+45 days')");
    else if(status==='valid')conditions.push("d.expires_on > date('now','+45 days')");
    const where=conditions.join(' AND ');const total=db.prepare(`SELECT COUNT(*) AS total FROM ${from} WHERE ${where}`).get(...values).total;
    const items=employee?db.prepare(`SELECT d.id,d.payload,d.expires_on,e.full_name,e.employee_number,
      (SELECT a.original_name FROM attachments a WHERE a.employee_document_id=d.id ORDER BY a.created_at DESC LIMIT 1) AS attachment_name,
      (SELECT a.id FROM attachments a WHERE a.employee_document_id=d.id ORDER BY a.created_at DESC LIMIT 1) AS attachment_id
      FROM ${from} WHERE ${where} ORDER BY e.full_name,d.expires_on,d.id LIMIT ? OFFSET ?`).all(...values,limit,offset)
      .map(r=>({...parsePayload(r.payload),id:r.id,employeeName:r.full_name,employeeNumber:r.employee_number,expiresOn:r.expires_on,attachmentName:r.attachment_name||'',attachmentId:r.attachment_id||''}))
      :db.prepare(`SELECT d.id,d.payload,d.expires_on,
      (SELECT a.original_name FROM attachments a WHERE a.organization_document_id=d.id ORDER BY a.created_at DESC LIMIT 1) AS attachment_name,
      (SELECT a.id FROM attachments a WHERE a.organization_document_id=d.id ORDER BY a.created_at DESC LIMIT 1) AS attachment_id
      FROM ${from} WHERE ${where} ORDER BY d.expires_on,d.id LIMIT ? OFFSET ?`).all(...values,limit,offset)
      .map(r=>({...parsePayload(r.payload),id:r.id,expiresOn:r.expires_on,attachmentName:r.attachment_name||'',attachmentId:r.attachment_id||''}));
    return {items,total};
  }
  conditions.push('organization_id=?','module=?');values.push(orgId,module);
  if(q){conditions.push('payload LIKE ?');values.push(needle);}
  if(status){conditions.push("json_extract(payload,'$.status')=?");values.push(status);}
  const where=conditions.join(' AND ');const total=db.prepare(`SELECT COUNT(*) AS total FROM app_records WHERE ${where}`).get(...values).total;
  const items=db.prepare(`SELECT id,payload FROM app_records WHERE ${where} ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`).all(...values,limit,offset).map(r=>({...parsePayload(r.payload),id:r.id}));
  return {items,total};
}
function moduleRecordExists(orgId,module,id){
  if(module==='employees')return !!db.prepare('SELECT 1 FROM employees WHERE id=? AND organization_id=?').get(id,orgId);
  if(module==='employeeDocs')return !!db.prepare('SELECT 1 FROM employee_documents WHERE id=? AND organization_id=?').get(id,orgId);
  if(module==='companyDocs')return !!db.prepare('SELECT 1 FROM organization_documents WHERE id=? AND organization_id=?').get(id,orgId);
  return !!db.prepare('SELECT 1 FROM app_records WHERE id=? AND organization_id=? AND module=?').get(id,orgId,module);
}
function validateRecord(module,record){
  if(!record||typeof record!=='object'||Array.isArray(record))return 'Record must be an object';
  const required=module==='employees'?['name','number']:module==='employeeDocs'?['employeeNumber','documentType','documentNo','expiresOn']:module==='companyDocs'?['name','documentNo','expiresOn']:[];
  for(const key of required)if(typeof record[key]!=='string'||!record[key].trim())return `${key} is required`;
  if(['employeeDocs','companyDocs'].includes(module)&&record.issuedOn&&record.expiresOn<record.issuedOn)return 'Expiry date must follow issue date';
  return null;
}
function saveModuleRecord(user,module,id,record,created=false){
  const now=new Date().toISOString();const payload={...record,id};
  if(module==='employees'){
    db.prepare(`INSERT INTO employees(id,organization_id,employee_number,full_name,payload,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET employee_number=excluded.employee_number,full_name=excluded.full_name,payload=excluded.payload,updated_at=excluded.updated_at`)
      .run(id,user.organization_id,payload.number,payload.name,JSON.stringify(payload),now);
  }else if(module==='employeeDocs'){
    const employee=db.prepare('SELECT id FROM employees WHERE organization_id=? AND employee_number=?').get(user.organization_id,payload.employeeNumber);
    if(!employee)throw Object.assign(new Error('Employee number was not found'),{status:422,code:'EMPLOYEE_NOT_FOUND'});
    const dates={type:payload.documentType,number:payload.documentNo,issue:payload.issuedOn||null,expiry:payload.expiresOn};
    db.prepare(`INSERT INTO employee_documents(id,organization_id,employee_id,document_type,document_number,issued_on,expires_on,payload,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET employee_id=excluded.employee_id,document_type=excluded.document_type,document_number=excluded.document_number,issued_on=excluded.issued_on,expires_on=excluded.expires_on,payload=excluded.payload,updated_at=excluded.updated_at`)
      .run(id,user.organization_id,employee.id,dates.type,dates.number,dates.issue,dates.expiry,JSON.stringify(payload),now);
  }else if(module==='companyDocs'){
    db.prepare(`INSERT INTO organization_documents(id,organization_id,title,document_type,document_number,issuing_authority,issued_on,expires_on,payload,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,document_type=excluded.document_type,document_number=excluded.document_number,issuing_authority=excluded.issuing_authority,issued_on=excluded.issued_on,expires_on=excluded.expires_on,payload=excluded.payload,updated_at=excluded.updated_at`)
      .run(id,user.organization_id,payload.name,payload.category||'',payload.documentNo,payload.authority||null,payload.issuedOn||null,payload.expiresOn,JSON.stringify(payload),now);
  }else{
    db.prepare(`INSERT INTO app_records(id,organization_id,module,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`)
      .run(id,user.organization_id,module,JSON.stringify(payload),now);
  }
  audit(user,created?'record.created':'record.updated',module,id);
  return payload;
}

app.get('/api/health',(_req,res)=>res.json({ok:true,service:'rakeza-local-api',version:1}));
app.get('/api/setup/status',(_req,res)=>res.json({initialized:!!db.prepare('SELECT id FROM users LIMIT 1').get()}));
app.get('/api/v1/overview',requireAuth,(req,res)=>{
  try{
    const orgId=req.user.organization_id;
    const people=db.prepare('SELECT COUNT(*) AS total FROM employees WHERE organization_id=?').get(orgId).total;
    const metrics=db.prepare(`SELECT
      SUM(CASE WHEN module='attendance' AND json_extract(payload,'$.status') IN ('حاضر','عن بُعد') THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN module='leaves' AND json_extract(payload,'$.status')='قيد المراجعة' THEN 1 ELSE 0 END) AS pending_leaves,
      SUM(CASE WHEN module='payroll' THEN CAST(json_extract(payload,'$.salary') AS REAL) ELSE 0 END) AS payroll_total,
      SUM(CASE WHEN module='absence' THEN CAST(json_extract(payload,'$.days') AS REAL) ELSE 0 END) AS absence_days,
      SUM(CASE WHEN module='leaves' THEN CAST(json_extract(payload,'$.days') AS REAL) ELSE 0 END) AS leave_days,
      SUM(CASE WHEN module='advances' THEN CAST(json_extract(payload,'$.amount') AS REAL) ELSE 0 END) AS advances_total,
      SUM(CASE WHEN module='contracts' AND json_extract(payload,'$.status')='منتهي' THEN 1 ELSE 0 END) AS expired_contracts,
      AVG(CASE WHEN module='payroll' THEN CAST(json_extract(payload,'$.salary') AS REAL) END) AS average_salary
      FROM app_records WHERE organization_id=?`).get(orgId);
    const canCompanyDocs=hasPermission(req.user,'companyDocs','read'),canEmployeeDocs=hasPermission(req.user,'employeeDocs','read');
    const hasDocuments=canCompanyDocs||canEmployeeDocs;
    const accessibleDocumentSources=[
      ...(canCompanyDocs?[{sql:'SELECT expires_on FROM organization_documents WHERE organization_id=?',orgId}]:[]),
      ...(canEmployeeDocs?[{sql:'SELECT expires_on FROM employee_documents WHERE organization_id=?',orgId}]:[])
    ];
    const expiryUnion=accessibleDocumentSources.map(source=>source.sql).join(' UNION ALL ');
    const bandCounts=hasDocuments?db.prepare(`SELECT
      SUM(CASE WHEN expires_on BETWEEN date('now') AND date('now','+7 days') THEN 1 ELSE 0 END) AS days_7,
      SUM(CASE WHEN expires_on>date('now','+7 days') AND expires_on<=date('now','+15 days') THEN 1 ELSE 0 END) AS days_15,
      SUM(CASE WHEN expires_on>date('now','+15 days') AND expires_on<=date('now','+30 days') THEN 1 ELSE 0 END) AS days_30,
      SUM(CASE WHEN expires_on>date('now','+30 days') AND expires_on<=date('now','+45 days') THEN 1 ELSE 0 END) AS days_45
      FROM (${expiryUnion})`).get(...accessibleDocumentSources.map(source=>source.orgId)):{days_7:0,days_15:0,days_30:0,days_45:0};
    const dueQueries=[];
    if(canCompanyDocs)dueQueries.push(`SELECT id,title AS name,document_type AS documentType,issuing_authority AS authority,NULL AS employeeName,expires_on AS expiresOn,'companyDocs' AS module,CAST(julianday(expires_on)-julianday(date('now')) AS INTEGER) AS daysRemaining FROM organization_documents WHERE organization_id=? AND expires_on BETWEEN date('now') AND date('now','+45 days')`);
    if(canEmployeeDocs)dueQueries.push(`SELECT d.id,d.document_type,d.document_type,NULL,e.full_name,d.expires_on,'employeeDocs',CAST(julianday(d.expires_on)-julianday(date('now')) AS INTEGER) FROM employee_documents d JOIN employees e ON e.id=d.employee_id WHERE d.organization_id=? AND d.expires_on BETWEEN date('now') AND date('now','+45 days')`);
    const expiredQueries=[];
    if(canCompanyDocs)expiredQueries.push(`SELECT id,title AS name,document_type AS documentType,issuing_authority AS authority,NULL AS employeeName,expires_on AS expiresOn,'companyDocs' AS module,CAST(julianday(expires_on)-julianday(date('now')) AS INTEGER) AS daysRemaining FROM organization_documents WHERE organization_id=? AND expires_on<date('now')`);
    if(canEmployeeDocs)expiredQueries.push(`SELECT d.id,d.document_type,d.document_type,NULL,e.full_name,d.expires_on,'employeeDocs',CAST(julianday(d.expires_on)-julianday(date('now')) AS INTEGER) FROM employee_documents d JOIN employees e ON e.id=d.employee_id WHERE d.organization_id=? AND d.expires_on<date('now')`);
    const dueDocuments=dueQueries.length?db.prepare(`${dueQueries.join(' UNION ALL ')} ORDER BY expiresOn LIMIT 5`).all(...accessibleDocumentSources.map(source=>source.orgId)):[];
    const expiredDocuments=expiredQueries.length?db.prepare(`${expiredQueries.join(' UNION ALL ')} ORDER BY expiresOn DESC LIMIT 3`).all(...accessibleDocumentSources.map(source=>source.orgId)):[];
    res.json({employeeCount:hasPermission(req.user,'employees','read')?people:0,presentCount:hasPermission(req.user,'attendance','read')?metrics.present_count||0:0,pendingLeaves:hasPermission(req.user,'leaves','read')?metrics.pending_leaves||0:0,payrollTotal:hasPermission(req.user,'payroll','read')?metrics.payroll_total||0:0,absenceDays:hasPermission(req.user,'absence','read')?metrics.absence_days||0:0,totalLeaveDays:hasPermission(req.user,'leaves','read')?metrics.leave_days||0:0,advancesTotal:hasPermission(req.user,'advances','read')?metrics.advances_total||0:0,expiredContracts:hasPermission(req.user,'contracts','read')?metrics.expired_contracts||0:0,averageSalary:hasPermission(req.user,'payroll','read')?Math.round(metrics.average_salary||0):0,expiryBands:hasDocuments?{7:bandCounts.days_7||0,15:bandCounts.days_15||0,30:bandCounts.days_30||0,45:bandCounts.days_45||0}:{7:0,15:0,30:0,45:0},dueDocuments:dueDocuments.filter(row=>row.module==='companyDocs'?canCompanyDocs:canEmployeeDocs),expiredDocuments:expiredDocuments.filter(row=>row.module==='companyDocs'?canCompanyDocs:canEmployeeDocs)});
  }catch(error){logSafeError(res,error);}
});
app.post('/api/setup/first-admin',async(req,res)=>{
  try{
    const peer=(req.socket.remoteAddress||'').replace(/^::ffff:/,'');
    if(peer!=='127.0.0.1'&&peer!=='::1')return res.status(403).json({code:'LOCAL_SETUP_ONLY',message:'Create the first administrator from the host device'});
    if(db.prepare('SELECT id FROM users LIMIT 1').get())return res.status(409).json({code:'ALREADY_INITIALIZED',message:'Initial setup is already complete'});
    const {organizationName,fullName,email,password}=req.body||{};
    if(!organizationName?.trim()||!fullName?.trim()||!email?.includes('@')||typeof password!=='string'||password.length<12)return res.status(422).json({code:'INVALID_SETUP',message:'Enter an organization, name, valid email, and password with at least 12 characters'});
    const organizationId=crypto.randomUUID(),userId=crypto.randomUUID();
    const create=db.transaction(()=>{if(db.prepare('SELECT id FROM users LIMIT 1').get())throw Object.assign(new Error('Initial setup is already complete'),{status:409});db.prepare('INSERT INTO organizations(id,name) VALUES(?,?)').run(organizationId,organizationName.trim());initializeOrganizationDefaults(organizationId);db.prepare('INSERT INTO users(id,organization_id,email,full_name,password_hash,role) VALUES(?,?,?,?,?,?)').run(userId,organizationId,email.trim().toLowerCase(),fullName.trim(),bcrypt.hashSync(password,12),'admin');});
    create();res.status(201).json({created:true});
  }catch(error){logSafeError(res,error);}
});
app.post('/api/auth/login',async(req,res)=>{
  try{
    const {email,password}=req.body||{};const user=db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE AND is_active=1').get(String(email||''));
    if(!user||!bcrypt.compareSync(String(password||''),user.password_hash))return res.status(401).json({code:'INVALID_CREDENTIALS',message:'Email or password is incorrect'});
    const token=crypto.randomBytes(32).toString('base64url');const sessionId=crypto.randomUUID();const expiresAt=new Date(Date.now()+12*60*60*1000).toISOString();
    db.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)').run(sessionId,user.id,hashToken(token),expiresAt);
    res.json({token,expiresAt,user:{id:user.id,email:user.email,fullName:user.full_name,role:user.role,permissions:getRolePermissions(user.organization_id,user.role)}});
  }catch(error){logSafeError(res,error);}
});
app.get('/api/auth/me',requireAuth,(req,res)=>res.json({user:{id:req.user.id,email:req.user.email,fullName:req.user.full_name,role:req.user.role,permissions:getRolePermissions(req.user.organization_id,req.user.role)}}));
app.post('/api/auth/logout',requireAuth,(req,res)=>{db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.sessionTokenHash);res.sendStatus(204);});
app.get('/api/organization/settings',requireAuth,(req,res)=>{
  const settings=db.prepare('SELECT country_code AS countryCode,currency_code AS currencyCode,locale,timezone,date_format AS dateFormat,week_start AS weekStart,weekend_days AS weekendDays FROM organization_preferences WHERE organization_id=?').get(req.user.organization_id);
  res.json({...settings,weekendDays:JSON.parse(settings.weekendDays),countries:countryProfiles});
});
app.get('/api/compliance/profile',requireAuth,(req,res)=>{
  const setting=db.prepare('SELECT country_code FROM organization_preferences WHERE organization_id=?').get(req.user.organization_id);
  const countryCode=setting?.country_code||'SA';
  const profile=regulationsByCountry[countryCode];
  res.json({countryCode,asOf:new Date().toISOString().slice(0,10),status:profile?'advisory_implementation':'regional_profile_only',rules:profile?.rules||[],sources:profile?.sources||[]});
});
app.post('/api/compliance/:countryCode/estimate',requireAuth,requirePermission('payroll','read'),(req,res)=>{
  const setting=db.prepare('SELECT country_code FROM organization_preferences WHERE organization_id=?').get(req.user.organization_id);
  const countryCode=String(req.params.countryCode||'').toUpperCase(),profile=regulationsByCountry[countryCode];
  if(!profile)return res.status(404).json({code:'COMPLIANCE_PROFILE_UNAVAILABLE',message:'No rule profile is available for this country'});
  if(setting?.country_code!==countryCode)return res.status(409).json({code:'COUNTRY_MISMATCH',message:'Rule estimates are available only for the organization country'});
  try{
    const {kind,...input}=req.body||{};
    let result;
    if(kind==='annualLeave')result=profile.minimumAnnualLeave(input);
    else if(kind==='endOfService')result=profile.estimateEndOfService(input);
    else if(kind==='overtime')result=profile.estimateOvertime(input);
    else if(kind==='socialInsurance')result=profile.estimateSocialInsurance(input);
    else return res.status(422).json({code:'INVALID_ESTIMATE_KIND',message:'Choose a supported estimate type'});
    if(!result)return res.status(422).json({code:'ESTIMATE_UNAVAILABLE',message:'This estimate type is not available for the selected country'});
    audit(req.user,'compliance.estimate.created',`${countryCode}:${kind}`,result.ruleId||null,{requiresHumanReview:true});
    const currencyCode=countryProfiles.find(country=>country.code===countryCode)?.currency||null;
    return res.json({countryCode,currencyCode,advisory:true,...result});
  }catch(error){if(error.status===422)return res.status(422).json({code:'INVALID_ESTIMATE_INPUT',message:error.message});return logSafeError(res,error);}
});
app.put('/api/organization/settings',requireAuth,requireRole('admin'),(req,res)=>{
  const {countryCode,currencyCode}=req.body||{};const profile=countryProfiles.find(country=>country.code===countryCode);
  if(!profile||typeof currencyCode!=='string'||!countryProfiles.some(country=>country.currency===currencyCode))return res.status(422).json({code:'INVALID_ORGANIZATION_SETTINGS',message:'Select a supported country and currency'});
  try{db.prepare(`UPDATE organization_preferences SET country_code=?,currency_code=?,locale=?,timezone=?,date_format=?,week_start=?,weekend_days=?,updated_at=CURRENT_TIMESTAMP WHERE organization_id=?`)
    .run(profile.code,currencyCode,profile.locale,profile.timezone,profile.dateFormat,profile.weekStart,JSON.stringify(profile.weekendDays),req.user.organization_id);
    audit(req.user,'organization.settings.updated','organization',req.user.organization_id,{countryCode,currencyCode});res.json({countryCode:profile.code,currencyCode,locale:profile.locale,timezone:profile.timezone,dateFormat:profile.dateFormat,weekStart:profile.weekStart,weekendDays:profile.weekendDays,countries:countryProfiles});
  }catch(error){logSafeError(res,error);}
});
app.get('/api/admin/roles',requireAuth,requireRole('admin'),(req,res)=>{
  const names={admin:['مدير النظام','System administrator'],hr:['الموارد البشرية','HR specialist'],manager:['مدير','Manager'],viewer:['مشاهد','Viewer']};
  const items=roles.map(key=>({key,nameAr:names[key][0],nameEn:names[key][1],permissions:Object.fromEntries(permissionModules.map(module=>[module,Object.fromEntries(permissionActions.map(action=>[action,!!db.prepare('SELECT enabled FROM role_permissions WHERE organization_id=? AND role_key=? AND module_key=? AND action_key=?').get(req.user.organization_id,key,module,action)?.enabled]))]))}));
  res.json({items,modules:permissionModules,actions:permissionActions});
});
app.put('/api/admin/roles/:roleKey/permissions',requireAuth,requireRole('admin'),(req,res)=>{
  const {roleKey}=req.params,permissions=req.body?.permissions;
  if(!roles.includes(roleKey)||roleKey==='admin')return res.status(422).json({code:'ROLE_PROTECTED',message:'The system administrator role cannot be changed'});
  if(!permissions||typeof permissions!=='object'||Array.isArray(permissions))return res.status(422).json({code:'INVALID_PERMISSIONS',message:'Provide a permission map'});
  try{const update=db.prepare('INSERT INTO role_permissions(organization_id,role_key,module_key,action_key,enabled) VALUES(?,?,?,?,?) ON CONFLICT(organization_id,role_key,module_key,action_key) DO UPDATE SET enabled=excluded.enabled,updated_at=CURRENT_TIMESTAMP');
    const save=db.transaction(()=>{for(const module of permissionModules)for(const action of permissionActions){const value=permissions[module]?.[action];if(typeof value!=='boolean')throw Object.assign(new Error('Every permission must be true or false'),{status:422});update.run(req.user.organization_id,roleKey,module,action,value?1:0);}});save();
    audit(req.user,'role.permissions.updated','role',roleKey);res.json({updated:true,role:roleKey});
  }catch(error){if(error.status)return res.status(error.status).json({code:'INVALID_PERMISSIONS',message:error.message});logSafeError(res,error);}
});
app.get('/api/admin/users',requireAuth,requireRole('admin'),(req,res)=>{
  const items=db.prepare('SELECT id,email,full_name AS fullName,role,is_active AS isActive,created_at AS createdAt FROM users WHERE organization_id=? ORDER BY full_name').all(req.user.organization_id);
  res.json({items,total:items.length});
});
app.post('/api/admin/users',requireAuth,requireRole('admin'),(req,res)=>{
  const {email,fullName,password,role='hr'}=req.body||{};
  if(!email?.includes('@')||!fullName?.trim()||typeof password!=='string'||password.length<12||!roles.includes(role))return res.status(422).json({code:'VALIDATION_ERROR',message:'Provide a valid email, full name, role, and password with at least 12 characters'});
  const id=crypto.randomUUID();try{db.prepare('INSERT INTO users(id,organization_id,email,full_name,password_hash,role) VALUES(?,?,?,?,?,?)').run(id,req.user.organization_id,email.trim().toLowerCase(),fullName.trim(),bcrypt.hashSync(password,12),role);audit(req.user,'user.created','user',id,{email,role});res.status(201).json({id,email:email.trim().toLowerCase(),fullName:fullName.trim(),role,isActive:true});}catch(error){if(String(error.code).includes('CONSTRAINT'))return res.status(409).json({code:'EMAIL_EXISTS',message:'A user with this email already exists'});logSafeError(res,error);}
});
app.patch('/api/admin/users/:id',requireAuth,requireRole('admin'),(req,res)=>{
  const {role,isActive}=req.body||{};if(role!==undefined&&!roles.includes(role))return res.status(422).json({code:'INVALID_ROLE',message:'Role is not supported'});
  const user=db.prepare('SELECT id FROM users WHERE id=? AND organization_id=?').get(req.params.id,req.user.organization_id);if(!user)return res.status(404).json({code:'NOT_FOUND',message:'User not found'});
  if(req.params.id===req.user.id&&(isActive===false||role&&role!=='admin'))return res.status(409).json({code:'SELF_LOCKOUT',message:'You cannot remove your own administrator access'});
  if(role!==undefined)db.prepare('UPDATE users SET role=? WHERE id=?').run(role,req.params.id);
  if(isActive!==undefined){db.prepare('UPDATE users SET is_active=? WHERE id=?').run(isActive?1:0,req.params.id);if(!isActive)db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.params.id);}
  audit(req.user,'user.updated','user',req.params.id,{role,isActive});res.json({updated:true});
});
app.get('/api/v1/modules/:module',requireAuth,requirePermission(req=>req.params.module,'read'),(req,res)=>{
  const {module}=req.params;if(!allowedModules.has(module)&&!['employeeDocs','companyDocs'].includes(module))return res.status(404).json({code:'MODULE_NOT_FOUND',message:'Module not found'});
  const page=Math.max(1,Number(req.query.page)||1),pageSize=Math.min(200,Math.max(1,Number(req.query.pageSize)||50));
  try{const result=findModulePage(req.user.organization_id,module,{q:String(req.query.q||'').trim(),status:String(req.query.status||''),limit:pageSize,offset:(page-1)*pageSize});res.json({...result,page,pageSize,pageCount:Math.ceil(result.total/pageSize)});}catch(error){logSafeError(res,error);}
});
app.post('/api/v1/modules/:module',requireAuth,requirePermission(req=>req.params.module,'create'),(req,res)=>{
  const {module}=req.params;if(!allowedModules.has(module)&&!['employeeDocs','companyDocs'].includes(module))return res.status(404).json({code:'MODULE_NOT_FOUND',message:'Module not found'});
  const issue=validateRecord(module,req.body);if(issue)return res.status(422).json({code:'VALIDATION_ERROR',message:issue});
  const id=crypto.randomUUID();try{const item=saveModuleRecord(req.user,module,id,req.body,true);res.status(201).json(item);}catch(error){if(error.status)return res.status(error.status).json({code:error.code,message:error.message});if(String(error.code).includes('CONSTRAINT'))return res.status(409).json({code:'CONFLICT',message:'A record with these details already exists'});logSafeError(res,error);}
});
app.put('/api/v1/modules/:module/:id',requireAuth,requirePermission(req=>req.params.module,'update'),(req,res)=>{
  const {module,id}=req.params;if(!allowedModules.has(module)&&!['employeeDocs','companyDocs'].includes(module))return res.status(404).json({code:'MODULE_NOT_FOUND',message:'Module not found'});
  const issue=validateRecord(module,req.body);if(issue)return res.status(422).json({code:'VALIDATION_ERROR',message:issue});
  try{if(!moduleRecordExists(req.user.organization_id,module,id))return res.status(404).json({code:'NOT_FOUND',message:'Record not found'});const item=saveModuleRecord(req.user,module,id,req.body);res.json(item);}catch(error){if(error.status)return res.status(error.status).json({code:error.code,message:error.message});logSafeError(res,error);}
});
app.delete('/api/v1/modules/:module/:id',requireAuth,requirePermission(req=>req.params.module,'delete'),(req,res)=>{
  const {module,id}=req.params;if(!allowedModules.has(module)&&!['employeeDocs','companyDocs'].includes(module))return res.status(404).json({code:'MODULE_NOT_FOUND',message:'Module not found'});
  try{
    let result;let files=[];
    if(module==='employees')files=db.prepare('SELECT a.stored_name FROM attachments a JOIN employee_documents d ON d.id=a.employee_document_id WHERE d.employee_id=?').all(id);
    else if(module==='employeeDocs')files=db.prepare('SELECT stored_name FROM attachments WHERE employee_document_id=?').all(id);
    else if(module==='companyDocs')files=db.prepare('SELECT stored_name FROM attachments WHERE organization_document_id=?').all(id);
    if(module==='employees')result=db.prepare('DELETE FROM employees WHERE id=? AND organization_id=?').run(id,req.user.organization_id);
    else if(module==='employeeDocs')result=db.prepare('DELETE FROM employee_documents WHERE id=? AND organization_id=?').run(id,req.user.organization_id);
    else if(module==='companyDocs')result=db.prepare('DELETE FROM organization_documents WHERE id=? AND organization_id=?').run(id,req.user.organization_id);
    else result=db.prepare('DELETE FROM app_records WHERE id=? AND organization_id=? AND module=?').run(id,req.user.organization_id,module);
    if(!result.changes)return res.status(404).json({code:'NOT_FOUND',message:'Record not found'});
    for(const file of files)fs.rmSync(path.join(documentDir,path.basename(file.stored_name)),{force:true});
    audit(req.user,'record.deleted',module,id);res.sendStatus(204);
  }catch(error){logSafeError(res,error);}
});
app.put('/api/v1/modules/:module/:id/attachment',requireAuth,requirePermission(req=>req.params.module,'update'),express.raw({type:['application/pdf','image/png','image/jpeg','image/webp'],limit:'8mb'}),(req,res)=>{
  const {module,id}=req.params;const contentType=req.headers['content-type'];
  if(!['companyDocs','employeeDocs'].includes(module))return res.status(404).json({code:'MODULE_NOT_FOUND',message:'Attachments are only supported for HR documents'});
  if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(422).json({code:'EMPTY_FILE',message:'Choose a non-empty PDF or image file'});
    let originalName=String(req.headers['x-file-name']||'document');try{originalName=decodeURIComponent(originalName);}catch{}originalName=originalName.slice(0,180).replace(/[\\/]/g,'_');
  try{
    const table=module==='employeeDocs'?'employee_documents':'organization_documents';
    const owner=db.prepare(`SELECT id FROM ${table} WHERE id=? AND organization_id=?`).get(id,req.user.organization_id);if(!owner)return res.status(404).json({code:'NOT_FOUND',message:'Document record not found'});
    const previous=db.prepare(`SELECT id,stored_name FROM attachments WHERE ${module==='employeeDocs'?'employee_document_id':'organization_document_id'}=?`).all(id);
    const storedName=`${crypto.randomUUID()}${path.extname(originalName).toLowerCase()}`;fs.writeFileSync(path.join(documentDir,storedName),req.body,{flag:'wx'});
    const attachmentId=crypto.randomUUID();db.prepare(`INSERT INTO attachments(id,organization_id,${module==='employeeDocs'?'employee_document_id':'organization_document_id'},original_name,stored_name,content_type,byte_size,uploaded_by) VALUES(?,?,?,?,?,?,?,?)`)
      .run(attachmentId,req.user.organization_id,id,originalName,storedName,contentType,req.body.length,req.user.id);
    for(const item of previous){db.prepare('DELETE FROM attachments WHERE id=?').run(item.id);fs.rmSync(path.join(documentDir,item.stored_name),{force:true});}
    audit(req.user,'attachment.uploaded',module,id,{name:originalName,bytes:req.body.length});res.status(201).json({id:attachmentId,name:originalName,size:req.body.length});
  }catch(error){if(error.type==='entity.too.large')return res.status(413).json({code:'FILE_TOO_LARGE',message:'Maximum file size is 8 MB'});logSafeError(res,error);}
});
app.get('/api/v1/attachments/:id',requireAuth,requireAttachmentPermission('read'),(req,res)=>{
  try{const item=db.prepare('SELECT * FROM attachments WHERE id=? AND organization_id=?').get(req.params.id,req.user.organization_id);if(!item)return res.status(404).json({code:'NOT_FOUND',message:'Attachment not found'});const file=path.join(documentDir,path.basename(item.stored_name));if(!fs.existsSync(file))return res.status(404).json({code:'FILE_MISSING',message:'Attachment file is missing'});res.type(item.content_type).download(file,item.original_name);}catch(error){logSafeError(res,error);}
});
app.delete('/api/v1/attachments/:id',requireAuth,requireAttachmentPermission('delete'),(req,res)=>{
  try{const item=db.prepare('SELECT * FROM attachments WHERE id=? AND organization_id=?').get(req.params.id,req.user.organization_id);if(!item)return res.status(404).json({code:'NOT_FOUND',message:'Attachment not found'});db.prepare('DELETE FROM attachments WHERE id=?').run(item.id);fs.rmSync(path.join(documentDir,path.basename(item.stored_name)),{force:true});audit(req.user,'attachment.deleted','attachment',item.id);res.sendStatus(204);}catch(error){logSafeError(res,error);}
});
app.get('/api/v1/documents/expiring',requireAuth,requireAnyPermission(['companyDocs','employeeDocs'],'read'),(req,res)=>{
  const withinDays=Math.max(0,Math.min(365,Number(req.query.withinDays)||45));
  try{
    const rows=db.prepare(`SELECT id,title AS name,document_type AS category,document_number AS documentNo,expires_on AS expiresOn,'companyDocs' AS module,NULL AS employeeName FROM organization_documents WHERE organization_id=? AND expires_on<=date('now',?)
      UNION ALL SELECT d.id,d.document_type,d.document_type,d.document_number,d.expires_on,'employeeDocs',e.full_name FROM employee_documents d JOIN employees e ON e.id=d.employee_id WHERE d.organization_id=? AND d.expires_on<=date('now',?) ORDER BY expiresOn`)
      .all(req.user.organization_id,`+${withinDays} days`,req.user.organization_id,`+${withinDays} days`);
    const visible=rows.filter(row=>hasPermission(req.user,row.module,'read'));
    res.json({items:visible,total:visible.length,withinDays});
  }catch(error){logSafeError(res,error);}
});
app.get('/api/v1/audit-events',requireAuth,requireRole('admin'),(req,res)=>{
  const page=Math.max(1,Number(req.query.page)||1),pageSize=Math.min(100,Math.max(1,Number(req.query.pageSize)||50));
  const total=db.prepare('SELECT COUNT(*) AS total FROM audit_events WHERE organization_id=?').get(req.user.organization_id).total;
  const items=db.prepare(`SELECT a.id,a.action,a.entity_type AS entityType,a.entity_id AS entityId,a.details,a.occurred_at AS occurredAt,u.full_name AS actor FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id WHERE a.organization_id=? ORDER BY a.id DESC LIMIT ? OFFSET ?`).all(req.user.organization_id,pageSize,(page-1)*pageSize);
  res.json({items,total,page,pageSize});
});
app.post('/api/admin/backup',requireAuth,requireRole('admin'),async(req,res)=>{
  try{
    const stamp=new Date().toISOString().replaceAll(':','-');const target=path.join(backupDir,`rakeza-${stamp}.sqlite`);
    await db.backup(target);const copyDir=path.join(backupDir,`rakeza-${stamp}-documents`);fs.cpSync(documentDir,copyDir,{recursive:true});
    audit(req.user,'backup.created','database',null,{file:path.basename(target)});res.status(201).json({database:path.basename(target),documents:path.basename(copyDir),location:backupDir});
  }catch(error){logSafeError(res,error);}
});
app.use((error,_req,res,_next)=>{if(error.type==='entity.too.large')return res.status(413).json({code:'PAYLOAD_TOO_LARGE',message:'Request is too large'});logSafeError(res,error);});

const isHost=process.env.RAKEZA_HOST_MODE==='host';
const host=isHost?'0.0.0.0':'127.0.0.1';
const port=Number(process.env.RAKEZA_PORT||47820);
const localSocket=process.env.RAKEZA_SOCKET;
let server;
if(localSocket){
  server=require('node:http').createServer(app);
}else if(isHost){
  if(!process.env.RAKEZA_TLS_CERT||!process.env.RAKEZA_TLS_KEY)throw new Error('Host mode requires a TLS certificate and private key.');
  try{server=https.createServer({cert:fs.readFileSync(process.env.RAKEZA_TLS_CERT),key:fs.readFileSync(process.env.RAKEZA_TLS_KEY)},app);}
  catch(error){throw new Error(`Could not load host TLS files: ${error.message}`);}
}else server=require('node:http').createServer(app);
server.listen(localSocket||port,...(localSocket?[]:[host]),()=>console.log(`Rakeza local API listening on ${localSocket||`${isHost?'https':'http'}://${host}:${port}`}; data: ${dataDir}`));
server.on('error',error=>console.error('Rakeza local API could not listen:',error.message));
let closing;
function closeServer(){if(closing)return closing;closing=new Promise(resolve=>server.close(()=>{db.close();resolve();}));return closing;}
function shutdown(){closeServer().finally(()=>process.exit(0));}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
module.exports={close:closeServer};
