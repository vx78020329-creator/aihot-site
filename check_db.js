const {db}=require('./db');
const s=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'").get();
console.log(s.sql);
