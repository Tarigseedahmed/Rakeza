const fs=require('node:fs');
const path=require('node:path');
const Database=require('better-sqlite3');

const source=process.argv[2];
const dataDir=process.argv[3];
if(!source||!dataDir){console.error('Usage: node scripts/restore-backup.cjs <backup.sqlite> <Rakeza data directory>');process.exit(2);}
const backup=path.resolve(source),targetDir=path.resolve(dataDir),target=path.join(targetDir,'rakeza.sqlite');
if(!fs.existsSync(backup)){console.error('Backup file does not exist.');process.exit(2);}
fs.mkdirSync(targetDir,{recursive:true});
const check=new Database(backup,{readonly:true,fileMustExist:true});
const result=check.pragma('integrity_check',{simple:true});check.close();
if(result!=='ok'){console.error('Backup failed SQLite integrity_check; restore cancelled.');process.exit(1);}
const staged=path.join(targetDir,`rakeza.restore-${Date.now()}.sqlite`);
fs.copyFileSync(backup,staged);
if(fs.existsSync(target))fs.copyFileSync(target,`${target}.before-restore-${Date.now()}`);
fs.renameSync(staged,target);
console.log(`Database restored from ${backup}. Restore the matching documents backup folder into ${path.join(targetDir,'documents')} as well.`);
