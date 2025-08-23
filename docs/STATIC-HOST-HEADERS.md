# Static-host headers

The production host must return these headers for every HTML document and
static asset. `vercel.json` is the Vercel source of truth; `serve.json` applies
the same policy when the exported `out/` directory is tested locally.

## Content Security Policy

```
default-src 'self'; base-uri 'self'; child-src 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; img-src 'self' data:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; worker-src 'self'
```

`'unsafe-inline'` is temporarily necessary in `script-src` and `style-src`
because the static Next.js output contains inline bootstrap scripts and style
rules. It does not permit an off-origin source. The policy blocks external
scripts, connections, fonts, frames, and plug-ins; images may be same-origin
or embedded data URLs only.

## Other headers

```
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

### Generic static-server example

```nginx
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; child-src 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; img-src 'self' data:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; worker-src 'self'" always;
add_header Referrer-Policy "no-referrer" always;
add_header X-Content-Type-Options "nosniff" always;
```
