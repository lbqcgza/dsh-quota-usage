# Security policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Use GitHub's
private vulnerability reporting instead:

<https://github.com/lbqcgza/dsh-quota-usage/security/advisories/new>

That form is private between you and the maintainer, and it is the channel this
project checks. A public issue is fine for anything that is not a security
problem — an ordinary bug, a crash, a wrong number.

## What this plugin is, and what that means for severity

`dsh-quota-usage` is a browser-side UI plugin that runs *inside* DeepSeek
Harness. It has no server side of its own:

- **It holds no credentials.** No token, no account, no API key. It never
  receives the DeepSeek account token: that stays in the host, which is what
  performs the authenticated request.
- **It registers no HTTP routes.** Its host half is an empty `apply` that exists
  only so the package holds a Loader row for the client module system to find.
- **It runs no shell commands and reads no files.** The Node half imports
  nothing and does nothing.
- **It sends nothing anywhere else.** The only outbound call is
  `remote.account.getBalance`, the same account namespace the shipped
  Settings → Account page reads, and the only data on it is the calling client's
  metadata (`version`, `locale`, `timezoneOffsetSeconds`) — the same three
  fields the official account pages send.
- **It writes no browser state.** No `localStorage`, `sessionStorage`, cookie,
  or `indexedDB` use.

The most useful reports are about the boundaries: a balance value or account
field rendered where it should not be; anything that leaves the widget's own DOM
subtree; a dependency injected into the client module graph in a way that lets a
third party read the account namespace through this plugin.

## Supported versions

The latest commit on `main` is what gets fixes. There are no maintained
back-branches.
