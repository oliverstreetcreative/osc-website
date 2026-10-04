// The diagnostics recorder (SPEC §29 v2), installed before paint in the client frame so it also catches a chunk that
// failed to load. It keeps, in sessionStorage (a reload doesn't wipe it), the last 20 page errors and the last 20
// failed SAME-ORIGIN requests: method, path (no query), status. Never bodies, never other sites' URLs.
export const DIAG_KEY = "osc.diag"

export const DIAG_SCRIPT = `(function(){try{
var K=${JSON.stringify(DIAG_KEY)},M=20;
function L(){try{var d=JSON.parse(sessionStorage.getItem(K)||"null");if(d&&d.errors&&d.failed)return d}catch(e){}return{errors:[],failed:[]}}
function P(k,x){try{var d=L();d[k].push(x);if(d[k].length>M)d[k]=d[k].slice(-M);sessionStorage.setItem(K,JSON.stringify(d))}catch(e){}}
function S(v){try{return String(v&&v.message||v||"").slice(0,300)}catch(e){return ""}}
window.addEventListener("error",function(e){P("errors",{kind:"js_error",msg:S(e&&(e.error||e.message)),at:Date.now()})},true);
window.addEventListener("unhandledrejection",function(e){P("errors",{kind:"rejection",msg:S(e&&e.reason),at:Date.now()})});
var C=console.error;console.error=function(){try{P("errors",{kind:"console_error",msg:Array.prototype.map.call(arguments,S).join(" ").slice(0,300),at:Date.now()})}catch(x){}return C.apply(console,arguments)};
var F=window.fetch;if(F){window.fetch=function(i,o){var m=((o&&o.method)||(i&&i.method)||"GET").toUpperCase(),u=null;try{u=new URL(typeof i==="string"?i:(i&&i.url)||String(i),location.href)}catch(x){}
var own=u&&u.origin===location.origin;
return F.apply(this,arguments).then(function(r){if(own&&!r.ok)P("failed",{method:m,path:u.pathname,status:r.status,at:Date.now()});return r},function(err){if(own)P("failed",{method:m,path:u.pathname,status:0,at:Date.now()});throw err})}}
}catch(e){}})()`
