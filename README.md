# Soikat Developer Pro — Ultimate Code Studio

Version 3.0 · English UI · GitHub + Vercel ready.

## What it does
- Attempts to identify common programming languages from file extensions and source-code signatures.
- Formats languages supported by the installed Prettier parsers (HTML, CSS/SCSS/Less, JavaScript, TypeScript, JSON/JSONC, Markdown/MDX, YAML and GraphQL).
- Uses safe best-effort whitespace cleanup for languages without an installed formatter. This fallback does **not** claim to repair their logic.
- Performs best-effort static deobfuscation for supported JavaScript-family source using WebCrack.
- Reports language-detection confidence, parser diagnostics, processing notes and input/output sizes.
- Keeps the original source in the left editor and returns it separately from the processed output.
- Accepts text source files up to 5 MB. The service never executes uploaded code.

## Important: what “any language” means
The tool can try to recognize many common languages, including Python, PHP, Java, C, C++, C#, Go, Rust, Ruby, SQL, shell scripts, PowerShell, TOML, INI, Dockerfile and Makefile. However, the current build has full formatting support only for the languages listed above. Other languages receive conservative whitespace cleanup unless you add a dedicated parser/formatter dependency.

No tool can reliably reconstruct arbitrary deleted source, unknown encryption, compiled binaries, proprietary bytecode, server-side code it cannot access, or runtime-generated logic from scrambled text alone. Low-confidence detection must be checked by a developer. “Readable” does not mean “correct” or “working”; test changes before deployment.

## Preserve your original code
The original stays in the source editor while the result appears separately. Download the result only after reviewing it. Keep an independent backup or use Git before processing important projects.

## Deploy to GitHub + Vercel
1. Extract this ZIP.
2. Upload the project files and folders to a GitHub repository.
3. In Vercel choose Add New → Project and import the repository.
4. Use the default/Other framework preset. Keep Build Command and Output Directory at defaults.
5. Deploy. Vercel serves `public/` and the processing endpoint from `api/`.

## Run locally
Requires Node.js 20+:
```bash
npm install
npx vercel dev
```

## Processing pipeline
1. Validate request and 5 MB text limit.
2. Detect language from a supported filename extension, selected type, or source signatures.
3. Attempt WebCrack static deobfuscation for JavaScript-family files in Pro mode.
4. Use a matching Prettier parser where available.
5. Fall back to a conservative formatter/whitespace cleanup if no parser can process the source.
6. Run Babel syntax inspection for JavaScript/TypeScript-family output.
7. Return output, original source, detection confidence, diagnostics and notes.

## Security and limitations
- Uploaded code is handled as text and is never executed by this service.
- Do not upload secrets to a public deployment. Client-side secrets are not secure.
- This is not a malware scanner, compiler, debugger or AI reasoning engine.
- Formatting is not the same as fixing program logic or proving that an app runs.
- Vercel request and execution limits apply.
- Review unknown code and compare output with the original before production use.

## Version 3.1 — Live Preview and upload experience
- Added a redesigned drag-and-drop upload area with a dedicated Browse Files action and file details.
- Added Live Preview actions for original source and processed output.
- HTML documents/fragments render in an isolated sandboxed iframe.
- CSS files render against a small sample page so common styles can be visually inspected.
- JavaScript-family files run in an isolated preview document; this is only a browser preview, not a full build environment.
- Unsupported server-side or compiled languages show a clear non-renderable preview explanation.
- Preview code runs in a sandboxed iframe without same-origin access to the editor. Treat untrusted code cautiously; preview scripts can still perform actions within their own isolated frame.
- 
