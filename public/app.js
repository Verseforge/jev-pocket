import { readApiResponse } from "./api-client.js";

const $ = s => document.querySelector(s); const $$ = s => [...document.querySelectorAll(s)];
const readSavedKey = () => { try { return localStorage.getItem("typesafeKey") || "" } catch { return "" } };
const state = { mode:"noul", key:readSavedKey() };
const presets={choice:["支持","销售","其他"],score:["很低","一般","很高"]};
const settings=$("#settings"), banner=$("#setupBanner"), extra=$("#extraFields");
function syncKey(){banner.classList.toggle("configured",!!state.key);$("#apiKey").value=state.key}
function renderExtra(){
  if(state.mode==="noul"){extra.hidden=true;extra.innerHTML="";return} extra.hidden=false;
  const title=state.mode==="choice"?"设置选项":"设置从低到高的等级";
  extra.innerHTML=`<p>${title}</p><div class="option-list">${presets[state.mode].map((v,i)=>`<div class="option-row"><input aria-label="选项 ${i+1}" value="${v}"><button class="remove-option" aria-label="删除">×</button></div>`).join("")}</div><button class="add-option">+ 添加一项</button>`;
  extra.querySelectorAll(".remove-option").forEach(b=>b.onclick=()=>{if(extra.querySelectorAll(".option-row").length>2)b.parentElement.remove()});
  extra.querySelector(".add-option").onclick=()=>{const row=document.createElement("div");row.className="option-row";row.innerHTML='<input aria-label="新选项" placeholder="输入一项"><button class="remove-option" aria-label="删除">×</button>';row.querySelector("button").onclick=()=>row.remove();extra.querySelector(".option-list").append(row);row.querySelector("input").focus()};
}
function openSettings(){syncKey();settings.showModal();setTimeout(()=>$("#apiKey").focus(),100)}
$("#settingsButton").onclick=openSettings;banner.onclick=openSettings;
$("#toggleKey").onclick=()=>{const i=$("#apiKey");i.type=i.type==="password"?"text":"password";$("#toggleKey").textContent=i.type==="password"?"显示":"隐藏"};
$("#saveKey").onclick=e=>{e.preventDefault();const key=$("#apiKey").value.trim();if(!key)return;try{localStorage.setItem("typesafeKey",key)}catch{}state.key=key;syncKey();settings.close()};
$("#clearKey").onclick=()=>{try{localStorage.removeItem("typesafeKey")}catch{}state.key="";syncKey();$("#apiKey").value=""};
$("#text").oninput=e=>$("#textCount").textContent=`${e.target.value.length}/5000`;
$$('.mode').forEach(b=>b.onclick=()=>{$$('.mode').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.mode=b.dataset.mode;renderExtra()});
function showResult(r){
  let main, pct=r.confidence||0, note="结果越接近 100%，倾向越明确";
  if(r.kind==="noul")main=`倾向于：${r.label}`;
  else if(r.kind==="choice")main=`更接近：${r.label}`;
  else {main=`综合程度：${r.score}`;note="分数会落在相邻两个等级之间";pct=r.confidence||Math.min(100,Math.max(10,r.score*25))}
  pct=Math.min(100,Math.max(0,Number(pct)||0));
  const panel=$("#resultPanel");panel.replaceChildren();
  const resultMain=document.createElement("div");resultMain.className="result-main";resultMain.textContent=main;
  const row=document.createElement("div");row.className="confidence-row";
  const track=document.createElement("div");track.className="confidence-track";
  const fill=document.createElement("div");fill.className="confidence-fill";fill.style.width=`${pct}%`;track.append(fill);
  const value=document.createElement("span");value.className="confidence-value";value.textContent=`${pct}%`;
  const resultNote=document.createElement("p");resultNote.className="result-note";resultNote.textContent=note;
  row.append(track,value);panel.append(resultMain,row,resultNote);
  $("#result").hidden=false;$("#result").scrollIntoView({behavior:"smooth",block:"start"});
}
$("#analyze").onclick=async()=>{
  const text=$("#text").value.trim(),question=$("#question").value.trim(),error=$("#formError");error.textContent="";
  if(!text||!question){error.textContent="请先填写内容和问题";return} if(!state.key){openSettings();return}
  const button=$("#analyze");button.disabled=true;button.textContent="正在判断…";
  try{const values=$$("#extraFields input").map(x=>x.value);const payload={text,question,mode:state.mode};if(state.mode==="choice")payload.options=values;if(state.mode==="score")payload.levels=values;
    const response=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json","X-TypeSafe-Key":state.key},body:JSON.stringify(payload)});const data=await readApiResponse(response);showResult(data.result)
  }catch(e){error.textContent=e.message||"暂时无法完成判断"}finally{button.disabled=false;button.textContent="开始判断"}
};
$("#reset").onclick=()=>{$("#result").hidden=true;$("#text").focus();scrollTo({top:0,behavior:"smooth"})};
syncKey();renderExtra();if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js");
