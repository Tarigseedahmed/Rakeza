const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');
const bcrypt = require('bcryptjs');
const { openDatabase } = require('../src/database.cjs');

const totalRows = Number(process.argv[2] || 1_000_000);
const batchSize = 10_000;
if (!Number.isSafeInteger(totalRows) || totalRows < 1 || totalRows > 1_000_000) {
  console.error('Choose a row count from 1 to 1,000,000.');
  process.exit(2);
}

const tempRoot = path.resolve(os.tmpdir());
const dataDir = path.join(tempRoot, `rakeza-stress-${process.pid}-${crypto.randomUUID()}`);
const resolvedDataDir = path.resolve(dataDir);
if (path.dirname(resolvedDataDir) !== tempRoot || !path.basename(resolvedDataDir).startsWith(`rakeza-stress-${process.pid}-`)) {
  throw new Error('Refusing to use a test path outside the temporary directory.');
}

;(async()=>{
let db;
let apiProcess;
function request(socketPath,token,requestPath,options={}){return new Promise((resolve,reject)=>{const headers={Authorization:`Bearer ${token}`,...options.headers};const body=options.body;const request=http.request({socketPath,path:requestPath,method:options.method||'GET',headers:{host:'localhost',...headers}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{const raw=Buffer.concat(chunks).toString();const result=response.statusCode===204?null:JSON.parse(raw||'null');if(response.statusCode<200||response.statusCode>=300)return reject(new Error(`${options.method||'GET'} ${requestPath} returned ${response.statusCode}: ${result?.message||'request failed'}`));resolve(result);});});request.on('error',reject);if(body)request.write(body);request.end();});}
async function waitForApi(socketPath){let lastError='';for(let attempt=0;attempt<300;attempt++){if(apiProcess.exitCode!==null)throw new Error(`API process exited before becoming ready (code ${apiProcess.exitCode})`);try{const response=await request(socketPath,'', '/api/health');if(response.ok)return;}catch(error){lastError=error.message;}await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`API did not become ready within 30 seconds: ${lastError}`);}
async function verifyApi(orgId){
  const userId=crypto.randomUUID(),token=crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO users(id,organization_id,email,full_name,password_hash,role) VALUES(?,?,?,?,?,?)').run(userId,orgId,`stress-${process.pid}@rakeza.invalid`,'Stress Test Admin',bcrypt.hashSync(crypto.randomBytes(24).toString('hex'),4),'admin');
  db.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)').run(crypto.randomUUID(),userId,crypto.createHash('sha256').update(token).digest('hex'),new Date(Date.now()+3600000).toISOString());
  db.close();db=null;
  const socketPath=`\\\\.\\pipe\\rakeza-stress-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  apiProcess=spawn(process.execPath,[path.join(__dirname,'..','src','server.cjs')],{cwd:path.join(__dirname,'..'),env:{...process.env,RAKEZA_DATA_DIR:resolvedDataDir,RAKEZA_SOCKET:socketPath,RAKEZA_HOST_MODE:'',RAKEZA_TLS_CERT:'',RAKEZA_TLS_KEY:''},stdio:['ignore','pipe','pipe']});
  let stderr='',stdout='';apiProcess.stderr.on('data',chunk=>{stderr+=chunk.toString();});apiProcess.stdout.on('data',chunk=>{stdout+=chunk.toString();});apiProcess.on('error',error=>{stderr+=error.message;});
  const stopped=new Promise(resolve=>apiProcess.once('exit',resolve));
  await waitForApi(socketPath).catch(error=>{throw new Error(`${error.message}${stderr?`: ${stderr}`:''}${stdout?` | ${stdout}`:''}`);});
  const timings={};
  let started=performance.now();
  const page=await request(socketPath,token,`/api/v1/modules/attendance?page=${Math.ceil(totalRows/100)}&pageSize=100`);
  timings.lastPageMs=Number((performance.now()-started).toFixed(2));
  if(page.total!==totalRows||page.page!==Math.ceil(totalRows/100)||page.items.length!==totalRows%100&&totalRows%100!==0||page.items.length!==Math.min(100,totalRows))throw new Error('Paged module API returned an incorrect total or page size');
  started=performance.now();const search=await request(socketPath,token,`/api/v1/modules/attendance?q=LOAD-${String(totalRows-1).padStart(7,'0')}&pageSize=50`);timings.searchMs=Number((performance.now()-started).toFixed(2));
  if(search.total!==1||search.items[0]?.id!==`stress-${String(totalRows-1).padStart(7,'0')}`)throw new Error('Filtered module API returned incorrect results');
  started=performance.now();const overview=await request(socketPath,token,'/api/v1/overview');timings.overviewMs=Number((performance.now()-started).toFixed(2));
  if(overview.presentCount!==totalRows)throw new Error(`Overview returned ${overview.presentCount} present records instead of ${totalRows}`);
  started=performance.now();const changed=await request(socketPath,token,`/api/v1/modules/attendance/stress-${String(totalRows-1).padStart(7,'0')}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`stress-${String(totalRows-1).padStart(7,'0')}`,name:'Updated load record',number:'LOAD-UPDATED',status:'حاضر'})});timings.updateMs=Number((performance.now()-started).toFixed(2));
  if(changed.name!=='Updated load record')throw new Error('Updating an existing record failed');
  apiProcess.kill('SIGTERM');await stopped;
  return {pageTotal:page.total,pageRows:page.items.length,searchTotal:search.total,overviewPresent:overview.presentCount,...timings};
}
const report = { requested: totalRows, batchSize, dataDir: resolvedDataDir };
try {
  db = openDatabase(resolvedDataDir);
  const organizationId = crypto.randomUUID();
  db.prepare('INSERT INTO organizations(id,name) VALUES(?,?)').run(organizationId, 'Rakeza stress-test workspace');

  const insert = db.prepare('INSERT INTO app_records(id,organization_id,module,payload,updated_at) VALUES(?,?,?,?,?)');
  const insertBatch = db.transaction((start, end) => {
    const updatedAt = new Date().toISOString();
    for (let i = start; i < end; i++) {
      const id = `stress-${String(i).padStart(7, '0')}`;
      const employeeNumber = `LOAD-${String(i).padStart(7, '0')}`;
      const payload = JSON.stringify({ id, name: `Load employee ${String(i).padStart(7, '0')}`, employeeNumber, date: '2026-11-10', status: 'حاضر' });
      insert.run(id, organizationId, 'attendance', payload, updatedAt);
    }
  });

  const insertionStarted = performance.now();
  for (let start = 0; start < totalRows; start += batchSize) {
    insertBatch(start, Math.min(start + batchSize, totalRows));
    if ((start + batchSize) % 100_000 === 0 || start + batchSize >= totalRows) {
      process.stdout.write(`Inserted ${Math.min(start + batchSize, totalRows).toLocaleString()} / ${totalRows.toLocaleString()}\n`);
    }
  }
  report.insertSeconds = Number(((performance.now() - insertionStarted) / 1000).toFixed(2));
  report.insertsPerSecond = Math.round(totalRows / (report.insertSeconds || 1));

  const apiStarted=performance.now();
  report.api=await verifyApi(organizationId);
  report.apiRoundTripSeconds=Number(((performance.now()-apiStarted)/1000).toFixed(2));
  db=openDatabase(resolvedDataDir);

  const countStarted = performance.now();
  report.count = db.prepare('SELECT COUNT(*) AS count FROM app_records WHERE organization_id=? AND module=?').get(organizationId, 'attendance').count;
  report.countMs = Number((performance.now() - countStarted).toFixed(2));

  const pageStarted = performance.now();
  const page = db.prepare('SELECT id,payload FROM app_records WHERE organization_id=? AND module=? ORDER BY updated_at DESC LIMIT 100 OFFSET ?').all(organizationId, 'attendance', Math.max(0, totalRows - 100));
  report.lastPageRows = page.length;
  report.lastPageMs = Number((performance.now() - pageStarted).toFixed(2));

  const pointLookup = db.prepare('SELECT id FROM app_records WHERE id=? AND organization_id=?');
  report.pointLookups = [0, Math.floor((totalRows - 1) / 2), totalRows - 1].map(i => pointLookup.get(`stress-${String(i).padStart(7, '0')}`, organizationId)?.id || null);
  report.integrity = db.pragma('integrity_check', { simple: true });
  report.foreignKeyViolations = db.pragma('foreign_key_check').length;
  db.pragma('wal_checkpoint(TRUNCATE)');
  report.databaseBytes = fs.statSync(path.join(resolvedDataDir, 'rakeza.sqlite')).size;

  const expectedLookups = [0, Math.floor((totalRows - 1) / 2), totalRows - 1].map(i => `stress-${String(i).padStart(7, '0')}`);
  const passed = report.count === totalRows && report.lastPageRows === Math.min(100, totalRows) && report.api.pageTotal===totalRows && report.api.searchTotal===1 && report.api.overviewPresent===totalRows && JSON.stringify(report.pointLookups) === JSON.stringify(expectedLookups) && report.integrity === 'ok' && report.foreignKeyViolations === 0;
  report.result = passed ? 'PASS' : 'FAIL';
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
} catch (error) {
  report.result = 'ERROR';
  report.error = error.message;
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  if(apiProcess&&apiProcess.exitCode===null){apiProcess.kill('SIGTERM');await new Promise(resolve=>apiProcess.once('exit',resolve));}
  if (db?.open) db.close();
  if (path.dirname(resolvedDataDir) === tempRoot && path.basename(resolvedDataDir).startsWith(`rakeza-stress-${process.pid}-`)) {
    fs.rmSync(resolvedDataDir, { recursive: true, force: true });
  }
}
})();
