var _=Object.defineProperty;var h=(e,t,n)=>t in e?_(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var s=(e,t,n)=>h(e,typeof t!="symbol"?t+"":t,n);var w="__framer_force_showing_editorbar_since",N="__framer_editor_button_position",c="2147483647";var W=300;var a=12,p="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAApNJREFUSA2tlUtLlFEYgEe7mtFFQ8NLFBG1SJAwahtiLVy5ceVSEPQH1LZf0Lp9FO1bdYNyI7gyBFcS2kAzilYq3sfxeYZ55Zv6FGfohWfOd97vnPd23u9MXeZoaeb1Q7gPHXAFzsAS5GACxiEPqVKXqs1kmtAPQi+cAtedToz1PJ8ExxPwDl7CAlRImoN7rBiF86ABHTiGAzMIh8n3O+ifwWc4EL0n5TGTYQijvjNSxbUadozInUeGZ3nuh1WYgpIkM+hGMwYajAgdrfUn+AaLoLTCAxiAOxCZxL4RdB+gZMjxEjwHo4hS8Jh5DR9hz0mKaNizegoNEI7Wee6FXJTISG6AUgDr+QImoAiHie+mwZJow/PRps4uwnsnRj8Epqc4voVJJ8eULOtW4BFYYjPpgjc+3IWI2sh/wFeoVl6xYQ48dDGLfjOwc/ygQqz595hUMVouS9QHBm4l6k3HWpnBLqicgVrlCxujSbR1Swd+UDpQYRS/oVaZZ2MWwlZBB9Zdxf+QTYw8SRgq6sAvz7vH6JULEB9USVHFjzZskgPRQR4ayxoXXIdaHdg9HrB2rErByWxZERnYtrWUzD0esDbtTmXPhzXwHrKLxEUbYGbVyDkWWwkdadfqbPmwDXZSCyh2VAf8BM/nOOJH5Y0QopMt2I5U/KO4DZZJB47XwEX+ex0mGroMV8sLwp56gyuGwiyW4SZ4c8bt2cZzO7jBNeqtsRHbeZ1g9krsMbhfYPv/c5gecA+4yAVuitFszE5Hjva872OMdXagF19JIoOYWyozMTI3J0tmA6gLvXPfO1cc/XOqOLe/HbjwD8yCXRD3VNJROEgatiRZMJsKsbZHia3nAdphtq8fkiWyXJbBe8uM1aXKPouNnz2Bm1kwAAAAAElFTkSuQmCC",E="__framer-editorbar-container",u="__framer-editorbar-label",d="__framer-editorbar-button",R="__framer-editorbar-loading-spinner",v="__framer-editorbar-button-tooltip-visible",I=`
#${E} {
    align-items: center;
    display: flex;
    gap: 8px;
    position: fixed;
    z-index: calc(${c});
    width: max-content;
    cursor: pointer;
}

#${u} {
    background-color: #111;
    border-radius: 8px;
    font-family: "Inter", "Inter-Regular", system-ui, Arial, sans-serif;
    font-size: 12px;
    height: fit-content;
    opacity: 0;
    padding: 4px 8px;
    transition: opacity 0.4s ease-out;
    font-weight: 500;
    flex-shrink: 0;
    position: fixed;
    width: max-content;
    pointer-events: none;
    user-select: none;
}

#${d} {
    all: unset;
    align-items: center;
    border-radius: 15px;
    display: flex;
    height: 30px;
    justify-content: center;
    width: 30px;
    flex-shrink: 0;
}

#${u}.${v} {
    opacity: 1;
}

#${u}, #${d} {
    backdrop-filter: blur(10px);
    background-color: rgba(34, 34, 34, 0.8);
    box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 4px 0px, rgba(0, 0, 0, 0.05) 0px 1px 0px 0px, rgba(255, 255, 255, 0.15) 0px 0px 0px 1px;
    color: #fff;
}

#${R} {
    width: ${a}px;
    height: ${a}px;
    -webkit-mask: url(${p});
    mask: url(${p});
    -webkit-mask-size: ${a}px;
    mask-size: ${a}px;
    background-color: #fff;


    animation-duration: 800ms;
    animation-iteration-count: infinite;
    animation-name: __framer-loading-spin;
    animation-timing-function: linear;
}

@keyframes __framer-loading-spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}
`,x=document.createElement("style");x.innerHTML=I;document.head.appendChild(x);var l=class extends Promise{constructor(){let n,o;super((r,m)=>{n=r,o=m});s(this,"_state","initial");s(this,"resolve");s(this,"reject");this.resolve=r=>{this._state="fulfilled",n(r)},this.reject=r=>{this._state="rejected",o(r)}}get state(){return this._state}pending(){return this._state="pending",this}isResolved(){return this._state==="fulfilled"||this._state==="rejected"}};l.prototype.constructor=Promise;function i(){return typeof navigator<"u"?navigator:void 0}var O=/Edg\//u;function g(){let e=i();return e?O.test(e.userAgent):!1}var T=/Chrome/u,S=/Google Inc/u;function A(){let e=i();return e?T.test(e.userAgent)&&S.test(e.vendor)&&!g():!1}var y=/AppleWebKit\//u;function k(){let e=i();return e?y.test(e.userAgent)&&!A()&&!g():!1}function X(){return typeof document=="object"}function D(){let e=i();return e?A()&&e.userAgent.toLowerCase().includes("; wv)"):!1}function L(){let e=i();return e?k()&&!e.userAgent.toLowerCase().includes("safari/"):!1}function Z(){return D()||L()}function b(e){let t=window.__framer_editorBarDependencies;if(!t)throw new Error("Dependencies not found");if(t.__version<1||t.__version>3)throw new Error("Unsupported version");let n=t[e];if(!n)throw new Error("Dependency not found");return n}var{createElement:f,memo:G,useCallback:K,useEffect:$,useRef:J,useState:Q,useLayoutEffect:q}=b("react");function ne(e,t,n){let{children:o,...r}=t??{};return n!==void 0&&(r.key=n),f(e,r,o)}function oe(e,t,n){let{children:o,...r}=t??{};return n!==void 0&&(r.key=n),f(e,r,...o)}function ie(e,...t){if(e)return;let n=Error("Assertion Error"+(t.length>0?": "+t.join(" "):""));if(n.stack)try{let o=n.stack.split(`
`);o[1]?.includes("assert")?(o.splice(1,1),n.stack=o.join(`
`)):o[0]?.includes("assert")&&(o.splice(0,1),n.stack=o.join(`
`))}catch{}throw n}function se(e,t){throw t instanceof Error?t:t!==void 0?new Error(String(t)):new Error(e?`Unexpected value: ${e}`:"Application entered invalid state")}export{s as a,w as b,N as c,c as d,W as e,E as f,u as g,d as h,R as i,v as j,l as k,X as l,Z as m,b as n,G as o,K as p,$ as q,J as r,Q as s,ie as t,se as u,ne as v,oe as w};
//# sourceMappingURL=/newgenre_static/assets/app.framerstatic.com__chunk-NOBVTTEN__ca74dac7decd.mjs.map
