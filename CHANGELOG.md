# Changelog

## 0.1.3

- Removed the Tool resource and its Run operation, at n8n's request: it passed a free-form JSON object to any GSC Wizard tool, so its fields were neither shown nor checked in the node.

## 0.1.2

- Moved Dimensions (Search Performance > Query) and Change Types (Search Performance > Get Ranking Changes) into each operation's Options collection, at n8n's request. Both keep their defaults when the option is not added: rows grouped by query, and all four change types.
- Marked Annotation > Scope as required: it always has a value and decides whether the Property field is shown.

## 0.1.1

- Removed the OAuth2 credential and the Authentication selector, at n8n's request: dynamic client registration is not yet generally available for community nodes. The API key credential covers every operation.

## 0.1.0

- First release of the GSC Wizard node, with API key and OAuth2 (dynamic client registration with PKCE) credentials.
- 30 operations across Account, Annotation, GA4, IndexNow, Insight, Property, Search Performance, Sitemap, Tool and URL Inspection.
- Usable as a tool by the n8n AI Agent.
