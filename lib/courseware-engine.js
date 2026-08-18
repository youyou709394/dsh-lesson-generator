/**
 * courseware-engine.js
 * dsh-lesson-generator 的课件引擎
 * 
 * 功能：根据单元内容数据（词汇/对话/Quiz/游戏数据），生成一个
 * 自包含的互动课件 HTML。内置翻牌/连连看/大转盘/猜猜看 4种游戏
 * + 口语跟读 + 小Quiz。完全离线可跑，无外部依赖，移动端优先。
 * 
 * 数据格式与悠悠成长中心课件游戏一致（见 english-courseware-games 技能）
 * 
 * ⚠️ 引号陷阱（2026-08-19踩坑）：在 PLAYER_JS 反引号模板串里，
 * 内层 `h+='...'` 单引号字符串中嵌入 onclick 参数时，不能用 `\'`（会
 * 破坏外层字符串），要用 `&apos;`（innerHTML 实体，浏览器解码为单引号）。
 */

// ============ 游戏函数 + 引擎逻辑（会注入到课件HTML） ============
const PLAYER_JS = `
/* ========== 通用辅助 ========== */
function gid(id){return document.getElementById(id)}
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));gid('page-'+id).classList.remove('hidden')}
var score=0;function addScore(n){score+=n;gid('petScore').textContent=score}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
var READ_DATA={dialog:'',keys:[]}

/* ========== 首页 ========== */
function initHome(){
  var h='<div class="card"><h2>📚 '+LESSON.grade+' '+LESSON.subject+' · '+LESSON.unit+'</h2><p style="font-size:16px;text-align:center;opacity:.9">词汇 '+LESSON.vocab.length+' 个 · 4个互动游戏 · 小Quiz</p></div>'
  h+='<div class="card"><h2>🎮 互动课堂</h2><button class="btn btn-primary" onclick="gFlip(&apos;flip&apos;,LESSON.flip)">🃏 翻牌配对</button><button class="btn btn-game" onclick="gConnect(&apos;connect&apos;,LESSON.connect)">🔗 连连看</button><button class="btn btn-game" onclick="gWheel(&apos;wheel&apos;,LESSON.wheel)">🎡 大转盘</button><button class="btn btn-game" onclick="gGuess(&apos;guess&apos;,LESSON.guess)">🤔 猜猜看</button></div>'
  h+='<div class="card"><h2>🗣 口语跟读</h2><button class="btn btn-game" onclick="gRead(&apos;read&apos;)">🔊 跟读对话</button></div>'
  h+='<div class="card"><h2>✅ 小Quiz</h2><button class="btn btn-game" onclick="gQuiz(&apos;quiz&apos;,LESSON.quiz)">📝 开始测验</button></div>'
  gid('page-home').innerHTML=h

  // 注入跟读数据
  READ_DATA.dialog = LESSON.dialog.map(function(d){return '<div class="dialog"><b>'+d.who+'</b>：'+d.text+'</div>'}).join('')
  READ_DATA.keys = LESSON.readKeys||[]
}

/* ========== 翻牌 ========== */
var flipData={}
function gFlip(pg,pairs){
  var d={pairs:shuffle(pairs.slice()),sel:null,matched:0}
  flipData[pg]=d
  var h='<div class="card"><h2>🃏 翻牌配对（点两面找配对）</h2><div class="grid">'
  d.pairs.forEach(function(_,i){h+='<div class="flip-card" id="fc'+i+'" onclick="onFlip(&apos;'+pg+'&apos;,'+i+')"><div class="front">?</div><div class="back"></div></div>'})
  h+='</div><div class="status" id="fs'+pg+'">已配对 0/'+pairs.length+'</div><button class="btn btn-game" onclick="showHome()">🏠 返回</button></div>'
  gid('page-'+pg).innerHTML=h
}
function showHome(){showPage('home')}
function onFlip(pg,i){
  var d=flipData[pg];if(d.matched>=d.pairs.length)return
  if(d.sel===i){d.sel=null;flipCard(pg,i,false);return}
  if(d.sel==null){d.sel=i;flipCard(pg,i,true);return}
  var a=d.sel,b=i
  flipCard(pg,b,true)
  if(d.pairs[a].emoji===d.pairs[b].emoji){
    d.matched++;d.sel=null;addScore(10)
    gid('fs'+pg).textContent='✅ 配对成功！('+d.matched+'/'+d.pairs.length+')'
    if(d.matched>=d.pairs.length)gid('fs'+pg).textContent='🎉 全部配对！+'+d.pairs.length*10+'分'
  }else{
    var prev=a
    gid('fs'+pg).textContent='❌ 再试试'
    setTimeout(function(){flipCard(pg,prev,false);flipCard(pg,b,false);d.sel=null},800)
  }
}
function flipCard(pg,i,on){
  var el=gid('fc'+i)
  if(on){el.classList.add('flipped');el.querySelector('.back').textContent=flipData[pg].pairs[i].emoji+' '+flipData[pg].pairs[i].word}
  else{el.classList.remove('flipped')}
}

/* ========== 连连看 ========== */
var cd={}
function gConnect(pg,pairs){
  var half=Math.floor(pairs.length/2)
  var ls=[],rs=[]
  for(var i=0;i<half;i++)ls.push({t:pairs[i].left,p:i})
  for(var i=half;i<pairs.length;i++)rs.push({t:pairs[i].right,p:i-half})
  shuffle(rs)
  cd[pg]={ls:ls,rs:rs,sel:null,mt:0,total:half}
  var h='<div class="card"><h2>🔗 连连看（连中英文）</h2><div style="display:flex;justify-content:space-between;gap:8px">'
  h+='<div style="flex:1">'+ls.map(function(v,i){return '<button class="btn btn-option" id="ll'+i+'" onclick="onL(&apos;'+pg+'&apos;,0,'+i+')">'+v.t+'</button>'}).join('')+'</div>'
  h+='<div style="flex:1">'+rs.map(function(v,i){return '<button class="btn btn-option" id="lr'+i+'" onclick="onL(&apos;'+pg+'&apos;,1,'+i+')">'+v.t+'</button>'}).join('')+'</div>'
  h+='</div><div class="status" id="ls'+pg+'">已连 0/'+half+'</div><button class="btn btn-game" onclick="showHome()">🏠 返回</button></div>'
  gid('page-'+pg).innerHTML=h
}
function onL(pg,side,i){
  var d=cd[pg]
  if(side===0){d.sel={side:0,i:i};hl(pg,i,true)}
  else{if(d.sel&&d.sel.side===0){if(d.ls[d.sel.i].p===d.rs[i].p){d.mt++;addScore(10);gid('ll'+d.sel.i).disabled=true;gid('lr'+i).disabled=true;hl(pg,d.sel.i,false);gid('ls'+pg).textContent='✅ 已连 '+d.mt+'/'+d.total;if(d.mt>=d.total)gid('ls'+pg).textContent='🎉 全连对！'}else{gid('ls'+pg).textContent='❌ 试试另一组合'};d.sel=null}}
}
function hl(pg,i,on){gid('ll'+i).style.background=on?'#ffd700':''}

/* ========== 大转盘 ========== */
var wd={}
function gWheel(pg,items){
  wd[pg]={items:shuffle(items.slice()),running:false}
  gid('page-'+pg).innerHTML='<div class="card"><h2>🎡 大转盘（转出单词）</h2><canvas id="wc" width="280" height="280" style="margin:0 auto;display:block"></canvas><button class="btn btn-primary" onclick="spinWheel(&apos;'+pg+'&apos;)">🎡 转！</button><div class="status" id="ws'+pg+'"></div><button class="btn btn-game" onclick="showHome()">🏠 返回</button></div>'
  drawWheel(pg)
}
function drawWheel(pg){
  var d=wd[pg],n=d.items.length,ctx=gid('wc').getContext('2d')
  var ang=2*Math.PI/n,start=-Math.PI/2
  for(var i=0;i<n;i++){
    ctx.beginPath();ctx.moveTo(140,140);ctx.arc(140,140,128,start+i*ang,start+(i+1)*ang)
    ctx.fillStyle=i%2?'#fff':'#ffd700';ctx.fill();ctx.strokeStyle='#ccc';ctx.lineWidth=1;ctx.stroke()
    ctx.save();ctx.translate(140,140);ctx.rotate(start+i*ang+ang/2)
    ctx.textAlign='right';ctx.fillStyle='#333';ctx.font='bold 13px sans-serif';ctx.fillText(d.items[i],112,5);ctx.restore()
  }
}
function spinWheel(pg){
  var d=wd[pg];if(d.running)return;d.running=true
  var cur=0,hold=1,decay=.97
  function step(){
    cur+=hold*(360/30);hold*=.97
    gid('wc').style.transform='rotate('+cur+'deg)'
    if(hold>.03)requestAnimationFrame(step)
    else{d.running=false;var idx=Math.floor((2*Math.PI-((cur*Math.PI/180)%(2*Math.PI)))/((2*Math.PI)/d.items.length))%d.items.length;if(idx<0)idx+=d.items.length;addScore(10);gid('ws'+pg).textContent='🎯 '+d.items[idx]+'！+10分'}
  }
  step()
}

/* ========== 猜猜看 ========== */
var gd={}
function gGuess(pg,qs){
  gd[pg]={qs:qs,i:0,c:0}
  renderGuess(pg)
}
function renderGuess(pg){
  var d=gd[pg],q=d.qs[d.i]
  if(!q){gid('page-'+pg).innerHTML='<div class="card"><h2>🤔 猜猜看</h2><div class="status" style="font-size:22px">🎉 答对 '+d.c+'/'+d.qs.length+'</div><button class="btn btn-game" onclick="showHome()">🏠 返回</button></div>';return}
  var h='<div class="card"><h2>🤔 猜猜看 '+(d.i+1)+'/'+d.qs.length+'</h2><p style="font-size:19px;text-align:center;margin:14px 0">'+q.hint+'</p>'
  q.options.forEach(function(o,j){h+='<button class="btn btn-option" style="text-align:center" id="go'+j+'" onclick="onGuess(&apos;'+pg+'&apos;,'+j+')">'+o+'</button>'})
  h+='<div class="status" id="gs'+pg+'"></div><button class="btn btn-game" onclick="showHome()">🏠 返回</button></div>'
  gid('page-'+pg).innerHTML=h
}
function onGuess(pg,j){
  var d=gd[pg],q=d.qs[d.i],el=gid('go'+j)
  if(q.options[j]===q.answer){el.style.background='#7bed9f';d.c++;addScore(10);gid('gs'+pg).textContent='✅ 正确！';setTimeout(function(){d.i++;renderGuess(pg)},700)}
  else{el.style.background='#ff6b6b';gid('gs'+pg).textContent='❌ '+q.answer;setTimeout(function(){d.i++;renderGuess(pg)},1200)}
}

/* ========== 口语跟读 ========== */
function gRead(pg){
  gid('page-'+pg).innerHTML='<div class="card"><h2>🗣 口语跟读</h2>'+READ_DATA.dialog+'<div class="status" style="font-size:16px">重点词：'+READ_DATA.keys.join('、')+'</div><button class="btn btn-game" onclick="showHome()">🏠 返回</button></div>'
}

/* ========== 小Quiz ========== */
var qz={}
function gQuiz(pg,items){
  qz[pg]={items:items,i:0,c:0}
  renderQuiz(pg)
}
function renderQuiz(pg){
  var d=qz[pg],q=d.items[d.i]
  if(!q){gid('page-'+pg).innerHTML='<div class="card"><h2>📝 小Quiz</h2><div class="status" style="font-size:22px">🎉 得分 '+d.c+'/'+d.items.length+'</div><button class="btn btn-game" onclick="showHome()">🏠 返回</button></div>';return}
  var h='<div class="card"><h2>📝 Quiz '+(d.i+1)+'/'+d.items.length+'</h2><div class="quiz"><div class="q">'+q.q+'</div>'
  q.options.forEach(function(o,j){h+='<button class="btn btn-option" style="text-align:center" id="qo'+j+'" onclick="onQuiz(&apos;'+pg+'&apos;,'+j+')">'+o+'</button>'})
  h+='</div><div class="status" id="qs'+pg+'"></div><button class="btn btn-game" onclick="showHome()">🏠 返回</button></div>'
  gid('page-'+pg).innerHTML=h
}
function onQuiz(pg,j){
  var d=qz[pg],q=d.items[d.i],el=gid('qo'+j)
  if(q.options[j]===q.correct){d.c++;addScore(10);gid('qs'+pg).textContent='✅ 正确！'}
  else{gid('qs'+pg).textContent='❌ 正确答案是 '+q.correct;el.style.background='#ff6b6b'}
  setTimeout(function(){d.i++;renderQuiz(pg)},800)
}
`

// ============ 构建完整课件 HTML ============
export function buildLessonHTML(c, d) {
  const lessonJSON = JSON.stringify({
    grade: c.grade || '三年级',
    subject: c.subject || '英语',
    unit: c.unit || 'Unit',
    vocab: c.vocab || d.vocab || [],
    flip: d.flip || [],
    connect: d.connect || [],
    wheel: d.wheel || [],
    guess: d.guess || [],
    dialog: d.dialog || [],
    readKeys: d.readKeys || [],
    quiz: d.quiz || [],
  })
  const title = (c.grade||'') + (c.subject||'') + ' · ' + (c.unit||'')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;padding:16px;color:#fff}
.container{max-width:640px;margin:0 auto}
h1{text-align:center;font-size:22px;margin:8px 0 16px;text-shadow:0 2px 4px rgba(0,0,0,.3)}
.card{background:rgba(255,255,255,.15);backdrop-filter:blur(10px);border-radius:16px;padding:16px;margin-bottom:14px}
.card h2{font-size:18px;margin-bottom:10px;border-left:4px solid #ffd700;padding-left:8px}
.btn{display:block;width:100%;padding:14px;margin:8px 0;border:none;border-radius:12px;font-size:18px;font-weight:600;cursor:pointer;transition:transform .1s}
.btn:active{transform:scale(.97)}
.btn-primary{background:#ffd700;color:#333}
.btn-game{background:#fff;color:#333}
.btn-option{background:rgba(255,255,255,.9);color:#333;text-align:left}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px}
.flip-card{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:22px;background:#fff;color:#333;border-radius:12px;cursor:pointer;transition:transform .5s;transform-style:preserve-3d;position:relative}
.flip-card.flipped{transform:rotateY(180deg)}
.flip-card .front,.flip-card .back{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;backface-visibility:hidden;border-radius:12px}
.flip-card .front{background:#fff;color:#999}
.flip-card .back{background:#ffd700;color:#333;transform:rotateY(180deg);font-size:13px;padding:4px;text-align:center}
.status{text-align:center;margin-top:10px;font-size:16px;min-height:24px}
.dialog{background:rgba(255,255,255,.9);color:#333;border-radius:12px;padding:14px;margin:8px 0;font-size:17px;line-height:1.6}
.home-btn{position:fixed;top:12px;left:12px;background:rgba(0,0,0,.3);color:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:20px;cursor:pointer;z-index:99}
.hidden{display:none!important}
.pet-top{position:fixed;bottom:12px;right:12px;background:rgba(255,255,255,.2);border-radius:20px;padding:8px 12px;font-size:14px;pointer-events:none;z-index:99}
</style>
</head>
<body>
<button class="home-btn" onclick="showHome()">🏠</button>
<div class="container">
<h1>${title}</h1>
<div id="page-home" class="page hidden"></div>
<div id="page-flip" class="page hidden"></div>
<div id="page-connect" class="page hidden"></div>
<div id="page-wheel" class="page hidden"></div>
<div id="page-guess" class="page hidden"></div>
<div id="page-read" class="page hidden"></div>
<div id="page-quiz" class="page hidden"></div>
</div>
<div class="pet-top">⭐ <span id="petScore">0</span></div>
<script>
var LESSON = ${lessonJSON};
${PLAYER_JS}
initHome();
showHome();
</script>
</body>
</html>`
}

// ============ 生成课件内容 JSON（供模型/调用方结构化使用） ============
export function buildLessonJSON(c, d) {
  return {
    unit: `${c.grade||''} ${c.subject||''} ${c.unit||''}`.trim(),
    vocab: c.vocab || d.vocab || [],
    games: {
      flip: d.flip || [],
      connect: d.connect || [],
      wheel: d.wheel || [],
      guess: d.guess || [],
    },
    reading: { dialog: d.dialog || [], keys: d.readKeys || [] },
    quiz: d.quiz || [],
  }
}
