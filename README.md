# n8n-nodes-gsc-wizard

This is an n8n community node for [GSC Wizard](https://gscwizard.com). It brings your Google Search Console and GA4 data into n8n workflows, lets you inspect URLs, submit sitemaps and IndexNow URLs, and manage the annotations on your GSC Wizard charts.

GSC Wizard is a Google Search Console tool that keeps the full history of your Search Console data, adds analyses such as content decay, cannibalization and anomaly detection, and connects GA4, Bing Webmaster Tools, Yandex Webmaster and Merchant Center. The node talks to the [GSC Wizard REST API](https://mcp.gscwizard.com/v1), so it reads the same data you see in the app.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Usage](#usage)
- [Example workflows](#example-workflows)
- [Compatibility](#compatibility)
- [Development](#development)
- [Resources](#resources)
- [Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. In short: open **Settings > Community Nodes**, select **Install**, enter `n8n-nodes-gsc-wizard` and confirm.

## Credentials

You need a GSC Wizard account with an active plan or trial, and at least one Search Console property connected and activated in the app. [Sign up at gscwizard.com](https://gscwizard.com); every new account starts with a free trial. The node signs in with an API key.

### API key

1. In the [GSC Wizard app](https://tool.gscwizard.com), open **Account > MCP API keys** and create a key. A key starts with `gscw_live_`.
2. Give the key **read & write** access if the workflow creates annotations, submits sitemaps or sends IndexNow URLs. A read-only key runs every read operation and is refused for those.
3. In n8n, create a **GSC Wizard API** credential and paste the key. n8n checks it against your account when you save.

## Operations

Every operation that reads one property has a **Property** field: pick the property from the list, or enter it by URL (`sc-domain:example.com` for a domain property, `https://www.example.com/` for a URL-prefix property).

| Resource | Operation | What it does |
| --- | --- | --- |
| Account | Get | Retrieve the account, its connected Google accounts and the subscription. |
| Annotation | Create, Delete, Get Many, Update | Manage the dated notes on the GSC Wizard performance chart, for one property or the whole account. Get Many also returns Google ranking updates. |
| GA4 | Get Many | List the GA4 properties GSC Wizard can read. |
| GA4 | Get Overview | Sessions, users, engagement and key events of the GA4 property linked to a Search Console property, with a comparison period. |
| GA4 | Run Report | GA4 metrics broken down by channel, source / medium, page, landing page, country, device, event, date or hostname. |
| IndexNow | Submit URLs | Tell Bing, Yandex and the other IndexNow search engines that up to 100 URLs were added or changed. |
| IndexNow | Get Many | The URLs sent to IndexNow for a property, newest first. |
| Insight | Detect Anomalies | Days where clicks, impressions, CTR or position broke from the normal range. |
| Insight | Find Cannibalization | Queries where several of your pages compete for the same clicks. |
| Insight | Find Decaying Content | Pages or queries that lost clicks against an earlier period, sortable by clicks lost or by percentage. |
| Insight | Score Opportunities | Queries ranked by the extra clicks a better position or CTR could bring. |
| Property | Get Many | The Search Console properties connected to GSC Wizard. |
| Property | Get Performance Summary | Clicks, impressions, CTR and average position, compared with the previous period. |
| Search Performance | Get Top Queries, Get Top Pages, Get Countries, Get Devices | The standard Search Console breakdowns, one item per row. |
| Search Performance | Query | A custom report with up to four dimensions (date, query, page, country, device, search appearance) and filters, including RE2 regular expressions. |
| Search Performance | Get Page Performance, Get Query Performance | Daily clicks, impressions, CTR and position of one page or one query. |
| Search Performance | Get Ranking Changes | Queries or pages that are new, lost, improved or declined against an earlier period. Each item has a `changeType` field. |
| Sitemap | Get Many | The sitemaps submitted for a property, with warnings and errors. |
| Sitemap | Submit | Submit up to 20 published sitemaps to Google Search Console. |
| Tool | Run | Run any GSC Wizard tool by name, for example the Bing, Yandex, Merchant Center or Core Web Vitals reports. |
| URL Inspection | Inspect | Ask Google for the index status of a URL: verdict, coverage, last crawl and canonicals. |
| URL Inspection | Get Many | Stored results of earlier inspections. |
| URL Inspection | Get Quota | How many inspections the property has left today. |

The n8n AI Agent can use every operation of this node as a tool.

## Usage

**Dates.** Leave the start and end dates out and a report covers the last 28 days that Search Console has settled data for. Search Console data runs two to three days behind, so a range that ends today is cut back to the latest settled day. The date pickers send the calendar day only, so the time of day you pick has no effect.

**One item per row.** List-shaped reports return one n8n item per row, which is what a Google Sheets, Airtable or Slack node expects. Turn on **Full Response** under **Options** to get the whole response as a single item instead, including totals, the share of clicks Google hides from query reports, and the freshness of the data.

**Return All and Limit.** The reports that Search Console pages through (top queries, top pages, countries, custom queries and stored inspections) fetch as many pages as **Return All** needs, up to 100 requests per run. The other reports take a **Limit** only, because the API returns their result in one response.

**Simplify.** URL Inspection, Detect Anomalies and Find Decaying Content return more than ten fields per row. **Simplify** is on by default and keeps the ten most useful ones; turn it off to get every field.

**Tool: Run.** This operation reaches the whole GSC Wizard API. Pick a tool from the list, then enter its input as a JSON object, for example `{"siteUrl": "sc-domain:example.com", "days": 28}`. The input fields of every tool are listed in the [OpenAPI reference](https://mcp.gscwizard.com/v1/openapi.json). When the tool returns a list, the node returns one item per row; the API names that list in the response's `listKey` field.

**Rate limits.** GSC Wizard limits requests per account. When a run hits the limit the node says so and stops; turn on **Retry On Fail** in the node settings to let n8n wait and try again.

**Errors.** Error messages say what went wrong and how to fix it, using GSC Wizard's own explanation where it gives one, for example a property that is not verified in Search Console or a plan that has ended.

## Example workflows

Import these from the [`examples`](examples) folder (**Workflows > Import from File**), then select your credential and property in each GSC Wizard node.

- [`weekly-decaying-content.json`](examples/weekly-decaying-content.json): every Monday at 08:00, list the 20 pages that lost the most clicks. Connect a Slack, email or Google Sheets node to the end to receive the list.
- [`inspect-and-submit-new-pages.json`](examples/inspect-and-submit-new-pages.json): when your CMS calls the webhook with `{"url": "..."}` after publishing a page, the workflow sends the URL to IndexNow and inspects it in Search Console.
- [`annotate-deploys.json`](examples/annotate-deploys.json): when your deploy pipeline calls the webhook with `{"version": "...", "notes": "..."}`, the workflow adds an annotation to the property chart, so a traffic change can be traced back to a release.

## Compatibility

Built with `@n8n/node-cli` 0.55 and tested on n8n 2.46.4. It works on every n8n version that supports community nodes (`n8nNodesApiVersion` 1).

## Development

```bash
npm install
npm run dev        # starts n8n on http://localhost:5678 with this node loaded
npm run lint       # n8n's community node lint rules
npm test           # builds, then runs the tests in test/
```

The tests run on Node's built-in test runner and need no n8n instance or network. `test/contract.test.js` runs every operation with every option set and checks each request against the input fields the GSC Wizard API accepts, which are kept in `test/fixtures/tool-inputs.json`. Refresh that file with `node scripts/update-tool-inputs.mjs` when the API changes.

Releases are published to npm from GitHub Actions with a provenance statement (`.github/workflows/publish.yml`), started by `npm run release`.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [GSC Wizard documentation](https://gscwizard.com/docs)
- [GSC Wizard REST API reference (OpenAPI)](https://mcp.gscwizard.com/v1/openapi.json)
- Questions or problems: [open an issue](https://github.com/jbobbink/n8n-nodes-gsc-wizard/issues) or email support@gscwizard.com

## Version history

### 0.1.2

Moves Dimensions (Search Performance > Query) and Change Types (Search Performance > Get Ranking Changes) into the Options collection, at n8n's request. Both keep their defaults when the option is not added.

### 0.1.1

Removes the OAuth2 credential at n8n's request, because dynamic client registration is not yet generally available for community nodes. The API key credential covers every operation. An existing node with OAuth2 selected needs a GSC Wizard API credential instead.

### 0.1.0

The first release: API key and OAuth2 credentials, and 30 operations across Account, Annotation, GA4, IndexNow, Insight, Property, Search Performance, Sitemap, Tool and URL Inspection.
