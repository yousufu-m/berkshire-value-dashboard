const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function model(stored = {}) {
 const items = new Map(Object.entries(stored));
 const ctx = vm.createContext({URL, console, localStorage: {getItem: key => items.get(key) ?? null, setItem: (key,value) => items.set(key,String(value)), removeItem: key => items.delete(key)}});
 for (const file of ['companies.js','app.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../docs/assets',file),'utf8'),ctx,{filename:file});
 return {run: source => vm.runInContext(source,ctx),items};
}
test('initial research data have 34 companies, 8 themes, and no verified quotes',()=>{
 const {run}=model();
 assert.equal(run('state.companies.length'),34);
 assert.equal(run('themeList().length'),8);
 assert.equal(run('state.companies.filter(verified).length'),0);
 assert.equal(run('state.reviews.length'),0);
});
test('zero-growth DCF equals an independently known perpetuity',()=>{
 const {run}=model(); assert(Math.abs(run('dcf(100,0,0,0,.10).value')-100/.1)<1e-8);
});
test('higher discount rate reduces value; permanent 20% earnings loss reduces value 20%',()=>{
 const {run}=model();
 assert(run('dcf(100,.05,.03,.02,.12).value < dcf(100,.05,.03,.02,.10).value'));
 assert(Math.abs(run('dcf(80,.05,.03,.02,.10).value / dcf(100,.05,.03,.02,.10).value')-.8)<1e-10);
});
test('invalid DCF assumptions are rejected',()=>{
 const {run}=model(); run('var assumptions = {ownerEarnings:100,requiredYield:8,g1:5,g2:3,gt:2,disc:10,targetMos:30}');
 assert.equal(run('checkValuation(assumptions)'),'');
 for(const patch of ['{disc:2}','{disc:0}','{g1:-100}','{g2:null}','{ownerEarnings:0}','{requiredYield:0}','{targetMos:101}']) assert(run(`checkValuation({...assumptions, ...${patch}})`));
});
test('missing values stay missing; zero remains zero',()=>{
 const {run}=model(); for(const value of ['null','undefined',"''","'  '"]) assert.equal(run(`num(${value})`),null);
 assert.equal(run("num('0')"),0); assert.equal(run('fmt(null)'),'—');
});
test('zero total weights suspend scores',()=>{
 const {run}=model(); assert.equal(run('Object.keys(state.weights).forEach(k=>state.weights[k]=0);scoreCompany(state.companies[0])'),null);
});
test('import rejects duplicate tickers, prototype keys, unsafe links, and invalid scores',()=>{
 const {run}=model();
 for(const change of ['d.companies.push(d.companies[0])',"d.companies[0].ticker='__proto__'","d.companies[0].meta.source='javascript:alert(1)'",'d.companies[0].scores.moat=50']) assert.throws(()=>run(`{const d=clone(payload());${change};validateData(d);}`));
});
test('untrusted text is escaped and CSV formulas are neutralized',()=>{
 const {run}=model(); assert.equal(run("safeText('<img src=x>')"),'&lt;img src=x&gt;');
 assert.equal(run("safeURL('javascript:alert(1)')"),''); assert(run("csvCell('=1+1')").startsWith("\"'"));
});
test('v2 backup round-trip retains watchlist, edited company, assumptions and review',()=>{
 const {run}=model();
 run(`profile('700.HK').watch=true;state.companies[0].price=123.45;state.valuationAssumptions['700.HK']={ownerEarnings:100,requiredYield:8,g1:5,g2:3,gt:2,disc:10,currency:'CNY'};state.reviews.push({id:'test-review',ticker:'700.HK',date:'2026-10-04',status:'weakened',note:'Test only'});state=validateData(JSON.parse(JSON.stringify(payload())));`);
 assert.equal(run("profile('700.HK').watch"),true);assert.equal(run('state.companies[0].price'),123.45);
 assert.equal(run("state.valuationAssumptions['700.HK'].ownerEarnings"),100);assert.equal(run('state.reviews[0].status'),'weakened');
});
test('legacy storage migrates and corrupted storage is not overwritten',()=>{
 const legacy=model({xw_reviews:JSON.stringify([{ticker:'700.HK',date:'2026-09-30',status:'unchanged',note:'Old review'}])});
 assert.equal(legacy.run('state.reviews.length'),1);const broken=model({xw_dashboard_v2:'{broken'});
 assert.equal(broken.run('state.companies.length'),34);assert.equal(broken.items.get('xw_dashboard_v2'),'{broken');assert(broken.run('bootWarning.length > 0'));
});
