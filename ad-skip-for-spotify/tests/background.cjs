const assert = require('node:assert/strict');
const {create} = require('../ad-skip.js');
function fixture(eventDriven = false) {
  let time = 0, playing = true, position = 179000, pauses = 0, nexts = 0, resumes = 0;
  let engine;
  const player = {
    data: {item: {uri: 'spotify:track:a'}, context: {uri:'spotify:playlist:list'}},
    getProgress:()=>position, getDuration:()=>180000, isPlaying:()=>playing,
    pause() {pauses++;playing=false;if(eventDriven)engine.tick();},
    next() {throw Error("Native next must not be called");},
    playUri(context, origin, options) {assert.equal(context,"spotify:playlist:list");assert.deepEqual(options.skipTo,{uri:"spotify:track:b",uid:"next-entry"});nexts++;player.data.item.uri='spotify:track:b';position=0;if(eventDriven)engine.tick();},
    play() {resumes++;playing=true;if(eventDriven)engine.tick();}
  };
  engine=create({Player:player,Queue:{nextTracks:[{contextTrack:{uri:"spotify:track:b",uid:"next-entry"}}]}},()=>true,()=>{},()=>time);
  return {engine, time:v=>time=v, counts:()=>[pauses,nexts,resumes]};
}
const delayed=fixture();
delayed.engine.tick();
delayed.time(60000); // Emulate a heavily delayed background timer after pause.
delayed.engine.tick();delayed.engine.tick();
assert.deepEqual(delayed.counts(),[1,1,1]);
const events=fixture(true);
events.engine.tick(); // Native events complete the transition without another timer.
assert.deepEqual(events.counts(),[1,1,1]);
events.engine.tick();assert.deepEqual(events.counts(),[1,1,1]);
console.log('PASS: delayed pause confirmation still advances; native state events finish transition without polling; no duplicate commands');
