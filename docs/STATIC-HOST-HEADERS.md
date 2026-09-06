# Static-host headers

The production host must return these headers for every HTML document and
static asset. `vercel.json` is the Vercel source of truth; `serve.json` applies
the same policy when the exported `out/` directory is tested locally. Both files
declare two blocks — a default and a `/embed/*` exception — and `pnpm check:csp`
fails if they drift apart.

## Content Security Policy

```
default-src 'self'; base-uri 'self'; child-src 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; img-src 'self' data:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; worker-src 'self'
```

`'unsafe-inline'` is temporarily necessary in `script-src` and `style-src`
because the static Next.js output contains inline bootstrap scripts and style
rules. It does not permit an off-origin source. The policy blocks external
scripts, connections, fonts, frames, and plug-ins; images may be same-origin
or embedded data URLs only.

## Framing: the one path-scoped exception

`/embed/*` is chromeless and exists to be framed by a third-party post, so it
receives a second header block that replaces `frame-ancestors 'none'` with
`frame-ancestors 'self' https:`. Every other directive is byte-identical to the
default policy:

```
default-src 'self'; base-uri 'self'; child-src 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'self' https:; frame-src 'none'; img-src 'self' data:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; worker-src 'self'
```

Two constraints follow from how hosts apply overlapping header blocks:

- **The default block must be declared first.** Both Vercel and `serve` apply
  every matching block in order and the last write to a header key wins, so a
  trailing default block would silently re-lock `/embed/`. `scripts/check-csp.mjs`
  fails if the order changes.
- **`frame-ancestors` cannot be set from a `<meta>` CSP.** A static host with no
  per-path header support will therefore apply the default policy everywhere and
  the embeds will not load. That is the accepted cost of the portability target:
  such a host serves a working app that simply cannot be embedded.

`X-Frame-Options` is deliberately not set. It has no path granularity on some
hosts, so adding it globally would override the exception above.

## Other headers

```
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()
```

### Generic static-server example

```nginx
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; child-src 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; img-src 'self' data:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; worker-src 'self'" always;
add_header Referrer-Policy "no-referrer" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Permissions-Policy "browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()" always;
```
