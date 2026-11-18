import { EDIT_ATTR, EDIT_TOKEN_KEY } from "@/lib/inline-edit-protocol";

// The script below runs INSIDE the sandboxed preview frame (opaque origin) while the user is in edit mode. It is plain
// ES5 kept in a string on purpose: nothing a bundler adds (helpers, renames) can leak into the frame, and there is no eval.
// Trust model: the frame is untrusted. It can only talk to the Studio page by postMessage with a per-session token, and
// whatever HTML it sends back goes through PUT /api/portfolio/html, which re-sanitises it. Nothing here is a security boundary.

const EDITOR_SOURCE = String.raw`(function(){
"use strict";
var hiddenBy=__HIDDEN__;
var TOKEN=__TOKEN__,PORIGIN=__PORIGIN__,SCROLL=__SCROLL__,KEY=__KEY__,A=__ATTRS__;
function send(m){m[KEY]=TOKEN;try{window.parent.postMessage(m,PORIGIN);}catch(e){}}
var SKIP={SCRIPT:1,STYLE:1,SVG:1,CANVAS:1,NOSCRIPT:1,TEMPLATE:1,HEAD:1,IFRAME:1,OBJECT:1,EMBED:1,VIDEO:1,AUDIO:1,SELECT:1,OPTION:1,TEXTAREA:1,INPUT:1,MATH:1,"SHIPFOLIO-WATERMARK":1};
var CONTAINER={HTML:1,BODY:1,MAIN:1,NAV:1,SECTION:1,HEADER:1,FOOTER:1,ARTICLE:1,ASIDE:1,UL:1,OL:1,TABLE:1,THEAD:1,TBODY:1,TFOOT:1,TR:1,FORM:1,FIELDSET:1,DL:1,MENU:1,HGROUP:1,FIGURE:1,DETAILS:1};
var INLINE={A:1,SPAN:1,STRONG:1,EM:1,B:1,I:1,U:1,S:1,SMALL:1,CODE:1,MARK:1,SUB:1,SUP:1,ABBR:1,CITE:1,TIME:1,BR:1,WBR:1,Q:1,KBD:1,VAR:1,DFN:1,DEL:1,INS:1,LABEL:1,IMG:1,PICTURE:1,SVG:1};
var PLAIN=(function(){try{var d=document.createElement("div");d.setAttribute("contenteditable","plaintext-only");return d.contentEditable==="plaintext-only";}catch(e){return false;}})();
var ORIG={},BR={},changed={},imgChanged={},nText=0,nImg=0,wasDirty=false,imgSeq=0;
function up(el){return el.tagName?el.tagName.toUpperCase():"";}
function inUi(el){return !!(el.closest&&(el.closest("["+A.ui+"]")||el.closest("shipfolio-watermark")||el.closest("[data-shipfolio-watermark]")));}
function hasOwnText(el){for(var n=el.firstChild;n;n=n.nextSibling){if(n.nodeType===3&&/\S/.test(n.nodeValue))return true;}return false;}
function onlyInline(el){var d=el.querySelectorAll("*");for(var i=0;i<d.length;i++){var x=d[i];if(x.closest("svg")&&x.tagName.toLowerCase()!=="svg"&&el.contains(x.closest("svg")))continue;if(!INLINE[up(x)])return false;}return true;}
function isBlock(el){var t=up(el);if(CONTAINER[t]||SKIP[t])return false;return hasOwnText(el)&&onlyInline(el);}
function skipEl(el){var t=up(el);return !!(SKIP[t]||el.hasAttribute(A.ui)||el.hasAttribute("hidden")||el.getAttribute("aria-hidden")==="true"||el.hasAttribute("data-shipfolio-watermark"));}
function hiddenEl(el,full){var cs,r;try{cs=window.getComputedStyle(el);r=el.getBoundingClientRect();}catch(e){return false;}return hiddenBy(cs,r,window.pageXOffset||0,window.pageYOffset||0,full);}
function walk(root){for(var c=root.firstElementChild;c;c=c.nextElementSibling){if(skipEl(c)||hiddenEl(c,false))continue;if(c.hasAttribute(A.text)){continue;}if(isBlock(c)){if(!hiddenEl(c,true))mark(c);}else{walk(c);}}}
function mark(el){var id=String(++nText);el.setAttribute(A.text,id);el.setAttribute("contenteditable",PLAIN?"plaintext-only":"true");ORIG[id]=el.innerHTML;BR[id]=!!el.querySelector("br");}
function userSrc(s){return /^data:image\//i.test(s)||/^shipfolio-storage:\/\//i.test(s)||/\/storage\/v1\/object\/sign\/uploads\//.test(s);}
function scanImages(){var els=document.querySelectorAll("img,[data-photo-slot]");for(var i=0;i<els.length;i++){var el=els[i];if(el.hasAttribute(A.image)||inUi(el)||hiddenEl(el,false))continue;var slot=el.hasAttribute("data-photo-slot");if(!slot&&!userSrc(el.getAttribute("src")||""))continue;if(!slot&&el.closest("[data-photo-slot]"))continue;
el.setAttribute(A.image,String(++imgSeq));nImg++;
if(!el.hasAttribute("tabindex")){el.setAttribute("tabindex","0");el.setAttribute(A.addedTabindex,"1");}
if(!el.hasAttribute("role")){el.setAttribute("role","button");el.setAttribute(A.addedRole,"1");}
if(!el.hasAttribute("aria-label")){el.setAttribute("aria-label","Replace photo"+(el.getAttribute("alt")?": "+el.getAttribute("alt"):""));el.setAttribute(A.addedLabel,"1");}}}
function imgById(id){return document.querySelector("["+A.image+"=\""+String(id).replace(/[^0-9]/g,"")+"\"]");}
function kindFor(el){var s=(el.getAttribute("src")||"");var d=el.getAttribute("data-photo-slot")||"";if(/^(photo|portrait|headshot)$/i.test(d)||/\/photo\//i.test(s))return "photo";return "project_image";}
function pick(el){send({type:"pick-image",id:el.getAttribute(A.image),kind:kindFor(el)});}
var live;function say(t){if(live){live.textContent="";setTimeout(function(){live.textContent=t;},30);}}
function labelOf(el){var t=up(el);if(/^H[1-6]$/.test(t))return "heading";if(t==="A")return "link";if(t==="BUTTON")return "button";if(t==="LI")return "list item";if(t==="TD"||t==="TH")return "table cell";return "text";}
function blockOf(t){return t&&t.closest?t.closest("["+A.text+"]"):null;}
function imgOf(t){return t&&t.closest?t.closest("["+A.image+"]"):null;}
function report(){var d=false,k;for(k in changed){d=true;break;}if(!d){for(k in imgChanged){d=true;break;}}if(d!==wasDirty){wasDirty=d;send({type:"dirty",dirty:d});}}
function commit(el){el.blur();say("Text kept. Press Save when done.");}
function nbsp(el){var w=document.createTreeWalker(el,4,null),n;while((n=w.nextNode())){if(n.nodeValue.indexOf("\u00a0")>-1)n.nodeValue=n.nodeValue.replace(/\u00a0/g," ");}}
function serialize(){var clone=document.documentElement.cloneNode(true);
function drop(sel){var n=clone.querySelectorAll(sel);for(var i=0;i<n.length;i++){if(n[i].parentNode)n[i].parentNode.removeChild(n[i]);}}
drop("["+A.ui+"]");drop("style["+A.style+"]");drop("script["+A.style+"]");drop("script["+A.guard+"]");drop("[data-shipfolio-watermark]");drop("shipfolio-watermark");
var tx=clone.querySelectorAll("["+A.text+"]");for(var i=0;i<tx.length;i++){var id=tx[i].getAttribute(A.text);if(changed[id]&&!/\u00a0|&nbsp;/.test(ORIG[id]||""))nbsp(tx[i]);tx[i].removeAttribute("contenteditable");tx[i].removeAttribute(A.text);}
var im=clone.querySelectorAll("["+A.image+"]");for(var j=0;j<im.length;j++){var e=im[j];if(e.hasAttribute(A.addedTabindex)){e.removeAttribute("tabindex");e.removeAttribute(A.addedTabindex);}if(e.hasAttribute(A.addedRole)){e.removeAttribute("role");e.removeAttribute(A.addedRole);}if(e.hasAttribute(A.addedLabel)){e.removeAttribute("aria-label");e.removeAttribute(A.addedLabel);}e.removeAttribute(A.image);}
var dt=document.doctype?"<!DOCTYPE "+document.doctype.name+">":"<!DOCTYPE html>";return dt+"\n"+clone.outerHTML;}
// Look: a faint dashed outline on every editable block, a solid one on focus; images get a dashed frame and a "Replace photo" chip.
var st=document.createElement("style");st.setAttribute(A.style,"1");
st.textContent="["+A.text+"]{outline:1px dashed rgba(37,99,235,.4)!important;outline-offset:3px;cursor:text;-webkit-user-select:text!important;user-select:text!important;pointer-events:auto!important}["+A.text+"]:hover{outline-color:#2563eb!important}["+A.text+"]:focus{outline:2px solid #2563eb!important;outline-offset:3px}["+A.text+"]:empty::before{content:\"Type here\";opacity:.5}["+A.image+"]{outline:2px dashed #2563eb!important;outline-offset:-2px;cursor:pointer;pointer-events:auto!important}["+A.image+"]:focus{outline:3px solid #2563eb!important}["+A.ui+"].sf-chip{position:fixed;display:none;pointer-events:none;background:#2563eb;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:6px 9px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.35);z-index:2147483000}";
document.head.appendChild(st);
var ui=document.createElement("div");ui.setAttribute(A.ui,"1");ui.setAttribute("aria-hidden","false");document.body.appendChild(ui);
live=document.createElement("div");live.setAttribute(A.ui,"1");live.setAttribute("role","status");live.setAttribute("aria-live","polite");live.style.cssText="position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";ui.appendChild(live);
var chips={};
function placeChips(){var els=document.querySelectorAll("["+A.image+"]");for(var i=0;i<els.length;i++){var el=els[i],id=el.getAttribute(A.image),c=chips[id];if(!c){c=document.createElement("span");c.setAttribute(A.ui,"1");c.setAttribute("aria-hidden","true");c.className="sf-chip";c.textContent="Replace photo";ui.appendChild(c);chips[id]=c;}
var r=el.getBoundingClientRect(),vh=window.innerHeight||document.documentElement.clientHeight,vw=window.innerWidth||document.documentElement.clientWidth;
if(r.width<48||r.height<32||r.bottom<0||r.top>vh||r.right<0||r.left>vw){c.style.display="none";}else{c.style.display="block";c.style.left=Math.max(4,Math.min(r.left+8,vw-120))+"px";c.style.top=Math.max(4,Math.min(r.top+8,vh-30))+"px";}}}
function scan(){walk(document.body);scanImages();placeChips();send({type:"ready",editable:nText,photos:nImg,canvas:!!document.querySelector("canvas")});}
// Keep the page's own scripts (games, menus, canvas) from reacting to clicks and keys on what is being edited.
var STOP=["mousedown","mouseup","pointerdown","pointerup","dblclick","touchstart","touchend","keypress","keyup"];
for(var s=0;s<STOP.length;s++){window.addEventListener(STOP[s],function(e){var t=e.target;if(blockOf(t)||imgOf(t))e.stopPropagation();},true);}
window.addEventListener("click",function(e){var t=e.target,a=t&&t.closest?t.closest("a,button,area"):null;var im=imgOf(t),bl=blockOf(t);if(a||im||bl){e.preventDefault();}if(im||bl){e.stopPropagation();}if(im){pick(im);}},true);
window.addEventListener("submit",function(e){e.preventDefault();},true);
window.addEventListener("focusin",function(e){var b=blockOf(e.target);if(b)say("Editing "+labelOf(b)+". Press Escape when done.");var im=imgOf(e.target);if(im)say("Photo. Press Enter to replace it.");},true);
window.addEventListener("input",function(e){var b=blockOf(e.target);if(!b)return;var id=b.getAttribute(A.text);if(b.innerHTML!==ORIG[id])changed[id]=1;else delete changed[id];report();},true);
window.addEventListener("beforeinput",function(e){if(!blockOf(e.target))return;var t=e.inputType||"";if(t.indexOf("format")===0||t==="insertFromDrop"||t==="insertFromYank")e.preventDefault();},true);
window.addEventListener("paste",function(e){var b=blockOf(e.target);if(!b)return;e.preventDefault();var txt="";try{txt=(e.clipboardData||window.clipboardData).getData("text/plain")||"";}catch(x){}txt=txt.replace(/\s*[\r\n]+\s*/g," ");if(txt)document.execCommand("insertText",false,txt);},true);
window.addEventListener("drop",function(e){if(blockOf(e.target))e.preventDefault();},true);
window.addEventListener("dragstart",function(e){if(blockOf(e.target)||imgOf(e.target))e.preventDefault();},true);
window.addEventListener("keydown",function(e){var t=e.target,b=blockOf(t),im=imgOf(t),mod=e.metaKey||e.ctrlKey;
if(mod&&!e.shiftKey&&!e.altKey&&(e.key==="s"||e.key==="S")){e.preventDefault();e.stopPropagation();send({type:"save-request"});return;}
if(e.key==="Escape"){e.preventDefault();e.stopPropagation();if(b){commit(b);}else if(im){im.blur();}else{send({type:"exit-request"});}return;}
if(b&&!e.isComposing&&e.key==="Enter"){e.preventDefault();e.stopPropagation();if(BR[b.getAttribute(A.text)]&&!mod){document.execCommand("insertLineBreak");}else{commit(b);}return;}
if(im&&(e.key==="Enter"||e.key===" ")){e.preventDefault();e.stopPropagation();pick(im);return;}
if(b||im){e.stopPropagation();}},true);
var lastY=-1,tm=0;window.addEventListener("scroll",function(){placeChips();if(tm)return;tm=setTimeout(function(){tm=0;var y=Math.round(window.pageYOffset||0);if(y!==lastY){lastY=y;send({type:"scroll",y:y});}},250);},true);
window.addEventListener("resize",placeChips);
window.addEventListener("message",function(e){if(e.source!==window.parent||e.origin!==PORIGIN)return;var d=e.data;if(!d||typeof d!=="object"||d[KEY]!==TOKEN)return;
if(d.type==="serialize"){var html="";try{html=serialize();}catch(x){}send({type:"html",reqId:String(d.reqId||""),html:html,scrollY:Math.round(window.pageYOffset||0)});}
else if(d.type==="set-image"){var el=imgById(d.id);var u=String(d.url||"");if(!el||!(/^data:image\//i.test(u)||(/^https?:\/\//i.test(u)&&u.indexOf("/storage/v1/object/sign/uploads/")>-1)))return;
if(el.tagName==="IMG"){el.removeAttribute("srcset");el.removeAttribute("sizes");el.src=u;el.addEventListener("load",placeChips);}else{while(el.firstChild)el.removeChild(el.firstChild);var im=document.createElement("img");im.alt=el.getAttribute("aria-label")||"Photo";im.style.cssText="width:100%;height:100%;object-fit:cover;display:block";im.src=u;im.addEventListener("load",placeChips);el.appendChild(im);}
imgChanged[d.id]=1;report();say("Photo replaced. Press Save when done.");}
else if(d.type==="saved"){for(var k in changed){delete changed[k];}for(var k2 in imgChanged){delete imgChanged[k2];}var all=document.querySelectorAll("["+A.text+"]");for(var i=0;i<all.length;i++){ORIG[all[i].getAttribute(A.text)]=all[i].innerHTML;}report();}
else if(d.type==="announce"){say(String(d.text||""));}},false);
if(SCROLL>0){window.scrollTo(0,SCROLL);window.addEventListener("load",function(){window.scrollTo(0,SCROLL);});}
scan();window.addEventListener("load",function(){scan();});setTimeout(scan,1200);
})();`;

/**
 * Decides whether an element is not visibly rendered. One self-contained function so it can be tested on its own (it only
 * reads the computed style and box it is given). `full` adds the size, clip and off-screen checks that apply to a text
 * block itself but not to a container (a container can be zero-sized while its children are visible).
 */
export const HIDDEN_FN_SOURCE = `function(cs,r,sx,sy,full){
if(cs.display==="none"||cs.visibility==="hidden"||cs.visibility==="collapse")return true;
if(!full)return false;
if(r.width<=1||r.height<=1)return true;
if(/^rect\\(\\s*0(px)?[ ,]+0(px)?[ ,]+0(px)?[ ,]+0(px)?\\s*\\)$/.test(cs.clip||""))return true;
if(/^inset\\(\\s*(50|100)%/.test(cs.clipPath||""))return true;
if((cs.position==="absolute"||cs.position==="fixed")&&(r.right+sx<=0||r.bottom+sy<=0))return true;
return false;}`;

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** The `<script>` that makes text and photos editable inside the preview frame. */
export function inlineEditorScript(opts: { token: string; parentOrigin: string; scrollY?: number }): string {
  // Function replacers: a string replacement would treat "$" sequences specially.
  const js = EDITOR_SOURCE.replace("__HIDDEN__", () => HIDDEN_FN_SOURCE)
    .replace("__TOKEN__", () => jsonForScript(opts.token))
    .replace("__PORIGIN__", () => jsonForScript(opts.parentOrigin))
    .replace("__SCROLL__", () => String(Math.max(0, Math.round(opts.scrollY ?? 0))))
    .replace("__KEY__", () => jsonForScript(EDIT_TOKEN_KEY))
    .replace("__ATTRS__", () => jsonForScript(EDIT_ATTR));
  return `<script ${EDIT_ATTR.style}>${js}</script>`;
}
