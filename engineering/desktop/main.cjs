const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, safeStorage, shell, nativeImage, Notification } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const tls = require('node:tls');

app.setName('Rakeza HR');
const isDev=process.argv.includes('--dev');
const configPath=path.join(app.getPath('userData'),'deployment.json');
const tokenPath=path.join(app.getPath('userData'),'session.enc');
const localRoot=process.env.LOCALAPPDATA||app.getPath('userData');
const defaultDataDir=path.join(localRoot,'Rakeza HR','data');
let mainWindow;
let tray;
let backendStarted=false;
let backendService;
let notificationTimer;
let notificationStatePath;
let notificationState={sent:{}};

if(!app.requestSingleInstanceLock()){app.quit();}else app.on('second-instance',()=>{mainWindow?.show();mainWindow?.focus();});

function ensurePortAvailable(port){return new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(error=>error?reject(error):resolve()));});}
async function waitForLocalApi(baseUrl){for(let attempt=0;attempt<40;attempt++){try{const response=await fetch(`${baseUrl}/api/health`,{signal:AbortSignal.timeout(750)});if(response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}throw new Error('The local data service did not start. Check that port 47820 is available.');}

function readConfig(){try{return JSON.parse(fs.readFileSync(configPath,'utf8'));}catch{return null;}}
function publicConfig(config){if(!config)return null;return {mode:config.mode,apiBaseUrl:config.apiBaseUrl,organizationName:config.organizationName||''};}
function persistConfig(config){fs.mkdirSync(path.dirname(configPath),{recursive:true});fs.writeFileSync(configPath,JSON.stringify(config,null,2),{mode:0o600});}
function ensureDesktopSecret(config){if(!config.desktopSecret)config.desktopSecret=crypto.randomBytes(32).toString('base64url');process.env.RAKEZA_DESKTOP_SECRET=config.desktopSecret;return config;}
function setStartupRegistration(config){const enabled=!!config?.notificationsEnabled&&config?.mode!=='client';if(app.isPackaged)app.setLoginItemSettings({openAtLogin:enabled,name:'Rakeza HR',args:['--background']});return enabled;}
function startLocalApi(config){
  if(backendStarted)return;
  process.env.RAKEZA_DATA_DIR=defaultDataDir;
  process.env.RAKEZA_PORT=String(config.port||47820);
  process.env.RAKEZA_HOST_MODE=config.mode==='host'?'host':'standalone';
  process.env.RAKEZA_DESKTOP_SECRET=config.desktopSecret;
  if(config.mode==='host'){process.env.RAKEZA_TLS_CERT=config.tlsCert;process.env.RAKEZA_TLS_KEY=config.tlsKey;}
  backendService=require('rakeza-hr-backend');
  backendStarted=true;
}
function createWindow(){
  mainWindow=new BrowserWindow({width:1440,height:940,minWidth:900,minHeight:650,show:false,backgroundColor:'#f6f8fb',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  mainWindow.once('ready-to-show',()=>{if(!process.argv.includes('--background'))mainWindow.show();});
  mainWindow.on('close',(event)=>{const config=readConfig();if(config?.notificationsEnabled&&!app.isQuitting){event.preventDefault();mainWindow.hide();}});
  mainWindow.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('mailto:thsedahmed@gmail.com')||url.startsWith('mailto:thsedahmed@hotmail.com'))shell.openExternal(url);return {action:'deny'};});
  mainWindow.webContents.on('will-navigate',(event,url)=>{const allowed=isDev?url.startsWith('http://127.0.0.1:5173'):url.startsWith('file://');if(allowed)return;if(url.startsWith('mailto:thsedahmed@gmail.com')||url.startsWith('mailto:thsedahmed@hotmail.com'))shell.openExternal(url);event.preventDefault();});
  if(isDev)mainWindow.loadURL('http://127.0.0.1:5173');
  else mainWindow.loadFile(path.join(process.resourcesPath,'app','index.html'));
}
function createTray(){
  if(tray)return;
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1e3a8a"/><text x="16" y="23" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="#fff">R</text></svg>';
  const iconPath=path.join(__dirname,'assets','rakeza.ico');const icon=fs.existsSync(iconPath)?nativeImage.createFromPath(iconPath).resize({width:16,height:16}):nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`).resize({width:16,height:16});tray=new Tray(icon);
  const config=readConfig();tray.setToolTip('Rakeza HR — Windows notifications active');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Rakeza HR',click:()=>mainWindow?.show()},{label:'Pause Windows notifications',click:()=>{if(config){config.notificationsEnabled=false;persistConfig(config);setStartupRegistration(config);clearInterval(notificationTimer);notificationTimer=null;mainWindow?.show();tray?.destroy();tray=null;}}},{type:'separator'},{label:'Quit',click:()=>{app.isQuitting=true;app.quit();}}]));
  tray.on('double-click',()=>mainWindow?.show());
}
function loadNotificationState(){notificationStatePath=path.join(app.getPath('userData'),'document-notifications.json');try{notificationState=JSON.parse(fs.readFileSync(notificationStatePath,'utf8'));if(!notificationState||typeof notificationState.sent!=='object')notificationState={sent:{}};}catch{notificationState={sent:{}};}}
function sendWindowsNotification(title,body){if(!Notification.isSupported())return false;const notification=new Notification({title,body,silent:false});notification.on('click',()=>mainWindow?.show());notification.show();return true;}
async function checkDocumentNotifications(){
  const config=readConfig();if(!config?.notificationsEnabled||config.mode==='client'||!config.desktopSecret)return;
  if(!Notification.isSupported())return;
  try{
    const response=await fetch(`${config.apiBaseUrl}/api/desktop/document-expiries`,{headers:{'X-Rakeza-Desktop-Secret':config.desktopSecret},signal:AbortSignal.timeout(8000)});
    if(!response.ok)return;const payload=await response.json();const freshByThreshold=new Map();const thresholds=[7,15,30,45];
    for(const item of payload.items||[]){const days=Number(item.daysRemaining);const threshold=thresholds.find(value=>days<=value);if(!threshold)continue;const key=`${item.module}:${item.id}:${item.expiresOn}:${threshold}`;if(notificationState.sent[key])continue;notificationState.sent[key]=new Date().toISOString();freshByThreshold.set(threshold,(freshByThreshold.get(threshold)||0)+1);}
    const keys=Object.keys(notificationState.sent);if(keys.length>5000){for(const key of keys.slice(0,keys.length-4000))delete notificationState.sent[key];}
    fs.mkdirSync(path.dirname(notificationStatePath),{recursive:true});fs.writeFileSync(notificationStatePath,JSON.stringify(notificationState),{mode:0o600});
    for(const [threshold,count] of freshByThreshold){const body=`${count} وثيقة على وشك الانتهاء خلال ${threshold} يوماً · ${count} document${count===1?'':'s'} expire within ${threshold} days. Open Rakeza HR to review.`;sendWindowsNotification('تنبيه وثائق · Rakeza HR',body);}
  }catch(error){console.warn('Document reminder check could not reach the local database:',error.message);}
}
function startDocumentNotifications(config){clearInterval(notificationTimer);notificationTimer=null;if(!config?.notificationsEnabled||config.mode==='client')return;ensureDesktopSecret(config);persistConfig(config);loadNotificationState();void checkDocumentNotifications();notificationTimer=setInterval(()=>void checkDocumentNotifications(),60*60*1000);}

ipcMain.handle('deployment:get',()=>publicConfig(readConfig()));
ipcMain.handle('deployment:reset',async()=>{if(backendService)await backendService.close();fs.rmSync(configPath,{force:true});fs.rmSync(tokenPath,{force:true});app.relaunch();app.quit();return true;});
ipcMain.handle('deployment:choose-tls',async()=>{
  const cert=await dialog.showOpenDialog(mainWindow,{title:'Select host TLS certificate',properties:['openFile'],filters:[{name:'PEM certificate',extensions:['pem','crt','cer']}]});
  if(cert.canceled||!cert.filePaths[0])return null;
  const key=await dialog.showOpenDialog(mainWindow,{title:'Select host TLS private key',properties:['openFile'],filters:[{name:'PEM private key',extensions:['pem','key']}]});
  if(key.canceled||!key.filePaths[0])return null;
  const securityDir=path.join(defaultDataDir,'security');fs.mkdirSync(securityDir,{recursive:true});
  const certTarget=path.join(securityDir,'host-cert.pem'),keyTarget=path.join(securityDir,'host-key.pem');
  try{tls.createSecureContext({cert:fs.readFileSync(cert.filePaths[0]),key:fs.readFileSync(key.filePaths[0])});}catch{throw new Error('The selected certificate and private key do not form a valid TLS pair');}
  fs.copyFileSync(cert.filePaths[0],certTarget);fs.copyFileSync(key.filePaths[0],keyTarget);
  return {tlsCert:certTarget,tlsKey:keyTarget};
});
ipcMain.handle('deployment:save',async(_event,value)=>{
  if(!value||!['standalone','host','client'].includes(value.mode))throw new Error('Choose a valid installation mode');
  const next={mode:value.mode,organizationName:String(value.organizationName||'').slice(0,120),port:47820};
  if(value.mode==='client'){
    const parsed=new URL(String(value.apiBaseUrl||''));if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('Enter a valid server URL');
    if(parsed.protocol==='http:'&&!['localhost','127.0.0.1'].includes(parsed.hostname))throw new Error('Client connections must use HTTPS');
    next.apiBaseUrl=parsed.origin;
  }else if(value.mode==='standalone')next.apiBaseUrl='http://127.0.0.1:47820';
  else{
    if(!value.tlsCert||!value.tlsKey)throw new Error('Select a TLS certificate and private key for the local host');
    const hostUrl=new URL(String(value.apiBaseUrl||''));if(hostUrl.protocol!=='https:')throw new Error('The host address must use HTTPS and match the selected certificate');
    next.apiBaseUrl=hostUrl.origin;next.tlsCert=value.tlsCert;next.tlsKey=value.tlsKey;
  }
  next.notificationsEnabled=value.notificationsEnabled!==false;if(next.mode!=='client')ensureDesktopSecret(next);persistConfig(next);
  if(next.mode!=='client'){await ensurePortAvailable(next.port);startLocalApi(next);await waitForLocalApi(next.apiBaseUrl);}
  setStartupRegistration(next);if(next.notificationsEnabled){createTray();startDocumentNotifications(next);}
  return publicConfig(next);
});
ipcMain.handle('auth:get-token',()=>{try{if(!safeStorage.isEncryptionAvailable()||!fs.existsSync(tokenPath))return null;return safeStorage.decryptString(fs.readFileSync(tokenPath));}catch{return null;}});
ipcMain.handle('auth:set-token',(_event,token)=>{if(typeof token!=='string'||token.length<32)throw new Error('Invalid session token');if(!safeStorage.isEncryptionAvailable())throw new Error('Secure token storage is unavailable on this device');fs.mkdirSync(path.dirname(tokenPath),{recursive:true});fs.writeFileSync(tokenPath,safeStorage.encryptString(token),{mode:0o600});return true;});
ipcMain.handle('auth:clear-token',()=>{fs.rmSync(tokenPath,{force:true});return true;});
ipcMain.handle('app:logout',()=>mainWindow?.show());
ipcMain.handle('notifications:get-settings',()=>({enabled:!!readConfig()?.notificationsEnabled,available:Notification.isSupported(),mode:readConfig()?.mode||null}));
ipcMain.handle('notifications:set-enabled',(_event,value)=>{const config=readConfig();if(!config||config.mode==='client')return {enabled:false,available:Notification.isSupported(),mode:config?.mode||null};config.notificationsEnabled=!!value;if(config.notificationsEnabled)ensureDesktopSecret(config);persistConfig(config);setStartupRegistration(config);if(config.notificationsEnabled){createTray();startDocumentNotifications(config);}else{clearInterval(notificationTimer);notificationTimer=null;tray?.destroy();tray=null;}return {enabled:config.notificationsEnabled,available:Notification.isSupported(),mode:config.mode};});

app.whenReady().then(async()=>{
  app.setAppUserModelId('com.rakeza.hr');
  let config=readConfig();if(config){const firstNotificationSetup=config.notificationsEnabled===undefined;config=ensureDesktopSecret(config);if(firstNotificationSetup)config.notificationsEnabled=true;persistConfig(config);if(firstNotificationSetup)setStartupRegistration(config);}
  if(config&&config.mode!=='client'){try{await ensurePortAvailable(config.port||47820);startLocalApi(config);await waitForLocalApi(config.apiBaseUrl);}catch(error){console.error('Could not start the local service:',error.message);}}
  createWindow();if(config?.notificationsEnabled){createTray();startDocumentNotifications(config);}
});
app.on('window-all-closed',()=>{if(!readConfig()?.notificationsEnabled)app.quit();});
app.on('before-quit',()=>clearInterval(notificationTimer));
