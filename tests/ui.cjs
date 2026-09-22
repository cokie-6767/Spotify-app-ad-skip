const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const data = new Map();
data.set('ad-skip-desktop-settings-v1',JSON.stringify({stopSeconds:30,panelHidden:false}));
function load() {
  const controls = {};
  let tick, paused = 0;
  const shadow = { set innerHTML(text) {}, getElementById(id) { return controls[id] ||= {value:'',textContent:'',events:{},addEventListener(name,fn){this.events[name]=fn;},focus(){shadow.activeElement=this;}}; } };
  const host = {style:{},dataset:{},attachShadow:()=>shadow,getBoundingClientRect:()=>({width:240,height:150,left:0,top:80})};
  const spice = {Player:{origin:{},data:{item:{uri:'spotify:track:a'}},getProgress:()=>179000,getDuration:()=>180000,isPlaying:()=>true,pause(){paused++;},playUri(){},play(){},addEventListener(){},removeEventListener(){}}};
  const context = vm.createContext({ document:{body:{append(){}},getElementById:()=>null,createElement:()=>host,addEventListener(){},removeEventListener(){}},Spicetify:spice,window:{innerWidth:1000,innerHeight:800,addEventListener(){}},localStorage:{getItem:key=>data.get(key)||null,setItem:(key,val)=>data.set(key,val)},console,performance:{now:()=>0},setInterval(fn){tick=fn;return 1;},setTimeout(){throw Error('Unexpected wait');},clearInterval(){} });
  vm.runInContext(fs.readFileSync('ad-skip.js','utf8'),context);
  return {controls,tick,paused:()=>paused};
}
const a=load();
assert.equal(a.controls.enabled.checked,true);
assert.equal(a.controls.seconds,undefined);
a.controls.enabled.checked=false; a.controls.enabled.events.change();a.tick();assert.equal(a.paused(),0);
a.controls.close.events.click(); assert.equal(a.controls.panel.hidden,true);
const b=load(); assert.equal(b.controls.enabled.checked,false); assert.equal(b.controls.panel.hidden,true);
b.controls.open.events.click(); assert.equal(b.controls.panel.hidden,false);
b.controls.enabled.checked=true;b.controls.enabled.events.change();b.tick();assert.equal(b.paused(),1);
assert.ok(b.controls.applied.textContent.includes('2 seconds before the end'));
console.log('PASS: only on/off control, legacy seconds ignored, off save/restore, close/reopen, enabled two-second operation');
