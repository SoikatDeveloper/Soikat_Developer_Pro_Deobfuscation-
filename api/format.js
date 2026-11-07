import { html as beautifyHtml, css as beautifyCss, js as beautifyJs, json as beautifyJson } from "js-beautify";
import prettier from "prettier";
import { deobfuscate } from "webcrack";
import { parse } from "@babel/parser";

const MAX = 5_000_000;
const supported = new Set([
  "html","htm","css","js","mjs","cjs","jsx","ts","tsx","json","jsonc","md","markdown",
  "yaml","yml","graphql","gql","xml","svg","vue","svelte","scss","less","mdx",
  "py","python","php","java","c","h","cpp","cc","cxx","hpp","cs","go","rs","rust",
  "rb","ruby","sql","sh","bash","zsh","ps1","powershell","toml","ini","conf",
  "dockerfile","makefile","txt"
]);

const parserMap = {
  html:"html",htm:"html",css:"css",scss:"scss",less:"less",
  js:"babel",mjs:"babel",cjs:"babel",jsx:"babel",ts:"typescript",tsx:"typescript",
  json:"json",jsonc:"json5",md:"markdown",markdown:"markdown",mdx:"mdx",
  yaml:"yaml",yml:"yaml",graphql:"graphql",gql:"graphql",xml:"html",svg:"html",
  vue:"vue",svelte:"svelte"
};
const languageNames = {
  html:"HTML",htm:"HTML",css:"CSS",scss:"SCSS",less:"Less",js:"JavaScript",mjs:"JavaScript",
  cjs:"JavaScript (CommonJS)",jsx:"React JSX",ts:"TypeScript",tsx:"TypeScript JSX",
  json:"JSON",jsonc:"JSONC",md:"Markdown",markdown:"Markdown",mdx:"MDX",yaml:"YAML",yml:"YAML",
  graphql:"GraphQL",gql:"GraphQL",xml:"XML",svg:"SVG",vue:"Vue",svelte:"Svelte",
  py:"Python",python:"Python",php:"PHP",java:"Java",c:"C",h:"C/C++ Header",cpp:"C++",cc:"C++",
  cxx:"C++",hpp:"C++ Header",cs:"C#",go:"Go",rs:"Rust",rust:"Rust",rb:"Ruby",ruby:"Ruby",
  sql:"SQL",shell:"Shell",sh:"Shell",bash:"Bash",zsh:"Zsh",ps1:"PowerShell",powershell:"PowerShell",
  toml:"TOML",ini:"INI",conf:"Config",dockerfile:"Dockerfile",makefile:"Makefile",txt:"Plain Text"
};

const send=(res,status,data)=>res.status(status).json(data);
const extOf=(name="")=>String(name).toLowerCase().split(/[./\\]/).pop();
function scoreLanguage(code) {
  const s=code.slice(0,30000);
  const tests=[
    ["html",[/<!doctype\s+html/i,/<html[\s>]/i,/<(head|body|div|main|section)\b/i]],
    ["json",[/^\s*[\[{]/,/^\s*"[A-Za-z0-9_-]+"\s*:/m,/"(?:true|false|null)"\s*[,}\]]/]],
    ["css",[/[.#][\w-]+\s*\{[^}]*:[^}]+;/s,/@media\b/,/--[\w-]+\s*:/]],
    ["sql",[/\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|CREATE\s+TABLE|ALTER\s+TABLE)\b/i,/;\s*(SELECT|INSERT|UPDATE|DELETE)\b/i,/^\s*(FROM|WHERE|JOIN|GROUP BY)\b/im]],
    ["python",[/^\s*(def|class)\s+\w+.*:/m,/^\s*(import|from)\s+[\w.]+/m,/^\s*(if|elif|else|for|while|try|with)\b.*:\s*$/m]],
    ["php",[/<\?php/i,/\$\w+\s*=/,/\becho\b/i]],
    ["java",[/\bpublic\s+(static\s+)?(class|interface|enum)\b/,/\bSystem\.out\.print/,/\bpackage\s+[\w.]+;/]],
    ["c",[/#include\s*[<"]/,/\bint\s+main\s*\(/,/\bprintf\s*\(/]],
    ["cpp",[/#include\s*<iostream>/,/\bstd::(cout|cin|string)\b/,/\busing\s+namespace\s+std\b/]],
    ["go",[/^\s*package\s+\w+/m,/^\s*func\s+\w+\s*\(/m,/"fmt"/]],
    ["rs",[/\bfn\s+main\s*\(/,/\blet\s+mut\b/,/\buse\s+std::/]],
    ["ruby",[/^\s*def\s+\w+/m,/^\s*puts\b/m,/^\s*end\s*$/m]],
    ["shell",[/^#!.*(bash|sh|zsh)/,/^\s*(export|fi|then|esac)\b/m,/^\s*\w+\(\)\s*\{/m]],
    ["yaml",[/^\s*[\w.-]+:\s+\S+/m,/^\s*-\s+\w+:/m,/^\s*(services|version|name):/m]],
    ["xml",[/^<\?xml\b/i,/<[A-Za-z][\w:.-]*[^>]*>[\s\S]*<\/[A-Za-z][\w:.-]*>/]],
    ["graphql",[/\b(query|mutation|subscription)\s+\w*\s*\{/,/\btype\s+\w+\s*\{/]],
    ["markdown",[/^#{1,6}\s+\S/m,/^\s*[-*+]\s+\S/m,/```[\w-]*\n/]]
  ];
  const ranked=tests.map(([lang,patterns])=>({lang,score:patterns.reduce((n,re)=>n+(re.test(s)?1:0),0)}))
    .filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return {type:"txt",confidence:"low",reason:"No reliable language signature found"};
  const top=ranked[0],second=ranked[1]?.score||0;
  return {type:top.lang,confidence:top.score>=2&&top.score>second?"high":top.score>second?"medium":"low",reason:"Detected from source-code patterns"};
}
function detectType(filename, requested, code) {
  const ext=extOf(filename);
  if(supported.has(ext))return {type:ext,confidence:"high",reason:"File extension"};
  if(requested&&requested!=="auto"&&supported.has(requested))return {type:requested,confidence:"high",reason:"Selected language"};
  return scoreLanguage(code);
}
function likelyObfuscated(s) {
  const compact=s.replace(/\s+/g,"");
  const escapes=(s.match(/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/gi)||[]).length;
  const enc=(s.match(/atob\s*\(|fromCharCode\s*\(|decodeURIComponent\s*\(/g)||[]).length;
  const vars=(s.match(/\b_[0-9a-f]{3,}\b/gi)||[]).length;
  return compact.length>1000&&(escapes>20||enc>2||vars>20);
}
function inspectJs(code,type) {
  try {
    parse(code,{sourceType:type==="cjs"?"script":"unambiguous",allowReturnOutsideFunction:type==="cjs",
      plugins:["jsx","typescript","decorators-legacy","classProperties","dynamicImport","importAttributes","topLevelAwait"]});
    return ["JavaScript/TypeScript syntax parser accepted the output."];
  } catch(e) { return ["Syntax diagnostic: "+e.message]; }
}
function safeIndent(text) {
  // Conservative fallback: preserve every token and line; only normalize leading indentation.
  return text.split(/\r?\n/).map(line=>line.replace(/[ \t]+$/,"")).join("\n");
}
export default async function handler(req,res) {
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"Only POST requests are supported."});}
  try {
    const {code,filename="source.txt",type:requestedType="auto",mode="pro"}=req.body||{};
    if(typeof code!=="string"||!code.trim())return send(res,400,{error:"Please provide non-empty source code."});
    if(code.length>MAX)return send(res,413,{error:"File exceeds the 5 MB processing limit."});
    const detected=detectType(filename,requestedType,code),type=detected.type;
    const notes=[],diagnostics=[];
    let output=code,deobfuscated=false,formatted=false,parserUsed=parserMap[type]||null;
    const js=["js","mjs","cjs","jsx","ts","tsx"].includes(type);
    const obfuscated=js&&likelyObfuscated(code);
    if(js&&mode!=="format-only") {
      try {
        const result=await deobfuscate(code);
        if(result?.code?.trim()&&result.code!==code){output=result.code;deobfuscated=true;notes.push("Static JavaScript deobfuscation completed. Inspect the result before use.");}
        else notes.push("No supported JavaScript obfuscation pattern was transformed.");
      } catch { notes.push("Deobfuscation could not safely transform this source; formatting was attempted."); }
    }
    if(parserUsed) {
      try {
        output=await prettier.format(output,{parser:parserUsed,printWidth:100,tabWidth:2,semi:true,singleQuote:true,trailingComma:"all",bracketSpacing:true});
        formatted=true;
      } catch(e) {
        notes.push("The selected formatter could not parse the source: "+e.message);
      }
    }
    if(!formatted) {
      if(["js","mjs","cjs","jsx","ts","tsx"].includes(type))output=beautifyJs(output,{indent_size:2});
      else if(["css","scss","less"].includes(type))output=beautifyCss(output,{indent_size:2});
      else if(["json","jsonc"].includes(type))output=beautifyJson(output,{indent_size:2});
      else if(["html","htm","xml","svg"].includes(type))output=beautifyHtml(output,{indent_size:2});
      else output=safeIndent(output);
      notes.push(parserUsed?"Conservative fallback used; source tokens were preserved.":"No built-in formatter for this language; whitespace cleanup only. Add a language formatter for deeper formatting.");
    }
    if(js)diagnostics.push(...inspectJs(output,type));
    if(obfuscated&&!deobfuscated)notes.push("Obfuscation indicators found, but no safe static transformation was available.");
    if(detected.confidence!=="high")notes.push("Language detection is "+detected.confidence+" confidence. Verify the detected language before relying on the result.");
    notes.push("The original source is returned separately so it can be compared and restored by the client.");
    notes.push("No source code is executed. No passwords, API keys, Firebase settings, URLs, login flows or application logic are intentionally removed.");
    notes.push("This tool cannot recreate deleted code, decrypt unknown encrypted payloads, or guarantee recovery of every language or proprietary bytecode.");
    return send(res,200,{
      output,original:code,type,language:languageNames[type]||"Unknown",detectionConfidence:detected.confidence,
      detectionReason:detected.reason,parserUsed,formatted,deobfuscated,originalSize:code.length,outputSize:output.length,
      notes,diagnostics
    });
  } catch(e) {
    return send(res,500,{error:"Unexpected processing error: "+(e?.message||"unknown error")});
  }
}
