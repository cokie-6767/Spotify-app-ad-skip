const assert = require('node:assert/strict');
const {create} = require('../ad-skip.js');
function setup(playlist=true) {
  let enabled=true, position=177999, playing=true, pauses=0, nexts=0, resumes=0;
  const player={data:{item:{uri:'spotify:track:a'},context:{uri:playlist?'spotify:playlist:list':'spotify:track:a'}},getProgress:()=>position,getDuration:()=>180000,isPlaying:()=>playing,pause(){playing=false;pauses++;},next(){throw Error("Native next must not be called");},playUri(context, origin, options){assert.equal(context,"spotify:playlist:list");assert.deepEqual(options.skipTo,{uri:"spotify:track:b",uid:"next-entry"});nexts++;player.data.item.uri='spotify:track:b';position=0;},play(){playing=true;resumes++;}};
  const engine=create({Player:player,Queue:{nextTracks:[{contextTrack:{uri:"spotify:track:b",uid:"next-entry"}}]}},()=>enabled);
  return {tick:engine.tick,seek:p=>position=p,toggle:e=>enabled=e,counts:()=>[pauses,nexts,resumes]};
}
{
 const f=setup(); f.tick();assert.deepEqual(f.counts(),[0,0,0]);
 f.seek(178000);f.tick();f.tick();f.tick();assert.deepEqual(f.counts(),[1,1,1]);
 f.tick();assert.deepEqual(f.counts(),[1,1,1]);
}
{
 const f=setup();f.toggle(false);f.seek(178000);f.tick();assert.deepEqual(f.counts(),[0,0,0]);
 f.toggle(true);f.tick();assert.deepEqual(f.counts(),[1,0,0]);
 f.toggle(false);f.tick();f.tick();assert.deepEqual(f.counts(),[1,0,0]);
}
{
 const f=setup(false);f.seek(178000);f.tick();f.tick();assert.deepEqual(f.counts(),[1,0,0]);
}
console.log('PASS: fixed two-second threshold; no action before two seconds; off prevents operations; off cancels pending advance; on resumes monitoring; playlist next/resume; no playlist stops only');
const {nextInPlaylist} = require('../ad-skip.js');
for (const context of ['spotify:album:test','spotify:collection:tracks','spotify:user:test:collection','spotify:playlist:list']) {
 const next=nextInPlaylist({context:{uri:context}}, {nextTracks:[{provider:'context',contextTrack:{uri:'spotify:track:b'}}]}, {});
 assert.equal(next.uri,'spotify:track:b');
}
assert.equal(nextInPlaylist({context:{uri:'spotify:track:a'}},{},{}),null);
console.log('PASS: actual album-context regression; playlist and Liked Songs advance; standalone track does not');
