// Contract test: every operation, with every option filled in, may only send
// fields the GSC Wizard tool accepts, and must send the fields it requires.
// The API rejects unknown fields with a 400, so a field the node invents (or
// one the API drops) breaks that operation for every user. The accepted fields
// come from test/fixtures/tool-inputs.json; refresh it with
// `node scripts/update-tool-inputs.mjs` when the API changes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { GscWizard } = require('../dist/nodes/GscWizard/GscWizard.node.js');
const { tools } = require('./fixtures/tool-inputs.json');

const site = { mode: 'list', value: 'sc-domain:example.com' };
const dates = {
	startDate: '2026-09-01T00:00:00',
	endDate: '2026-09-28T00:00:00',
};
const comparison = {
	comparisonStartDate: '2026-08-01T00:00:00',
	comparisonEndDate: '2026-08-28T00:00:00',
};

// One entry per operation, each with every option the node offers for it.
const CASES = [
	{ resource: 'property', operation: 'getAll', returnAll: true },
	{
		resource: 'property',
		operation: 'getSummary',
		siteUrl: site,
		options: { ...dates, brand: 'branded', days: 28, searchType: 'all' },
	},
	...['getTopQueries', 'getTopPages', 'getCountries'].map((operation) => ({
		resource: 'searchPerformance',
		operation,
		siteUrl: site,
		returnAll: false,
		limit: 10,
		options: { ...dates, brand: 'non_branded', searchType: 'image' },
	})),
	{
		resource: 'searchPerformance',
		operation: 'getDevices',
		siteUrl: site,
		returnAll: false,
		limit: 10,
		options: { ...dates, brand: 'branded', searchType: 'web' },
	},
	{
		resource: 'searchPerformance',
		operation: 'query',
		siteUrl: site,
		filters: { filter: [{ dimension: 'page', operator: 'contains', expression: '/blog/' }] },
		returnAll: false,
		limit: 10,
		options: { ...dates, dimensions: ['query', 'page'], searchType: 'news' },
	},
	{
		resource: 'searchPerformance',
		operation: 'getPagePerformance',
		siteUrl: site,
		pageUrl: 'https://example.com/a',
		options: { ...dates, searchType: 'web' },
	},
	{
		resource: 'searchPerformance',
		operation: 'getQueryPerformance',
		siteUrl: site,
		query: 'shoes',
		options: { ...dates, pageUrl: 'https://example.com/a', searchType: 'web' },
	},
	{
		resource: 'searchPerformance',
		operation: 'getRankingChanges',
		siteUrl: site,
		limit: 50,
		options: {
			...dates,
			...comparison,
			changeTypes: ['new'],
			dimension: 'page',
			searchType: 'web',
		},
	},
	{
		resource: 'urlInspection',
		operation: 'inspect',
		siteUrl: site,
		inspectionUrl: 'https://example.com/a',
		simplify: true,
	},
	{
		resource: 'urlInspection',
		operation: 'getAll',
		siteUrl: site,
		returnAll: false,
		limit: 10,
		simplify: false,
		options: { latestPerUrl: true, urlContains: '/blog/' },
	},
	{ resource: 'urlInspection', operation: 'getQuota', siteUrl: site },
	{ resource: 'sitemap', operation: 'getAll', siteUrl: site, returnAll: true },
	{
		resource: 'sitemap',
		operation: 'submit',
		siteUrl: site,
		sitemapUrls: 'https://example.com/sitemap.xml',
	},
	{
		resource: 'annotation',
		operation: 'create',
		scope: 'property',
		siteUrl: site,
		eventDate: '2026-09-10T00:00:00',
		label: 'Launch',
		additionalFields: { category: 'release', color: '#ff0000', description: 'New site' },
	},
	{
		resource: 'annotation',
		operation: 'update',
		annotationId: '3f2b6c1e-8d4a-4f7b-9c2e-1a5d6e7f8a9b',
		updateFields: {
			category: 'release',
			color: '#ff0000',
			description: 'x',
			eventDate: '2026-09-11T00:00:00',
			label: 'Relaunch',
		},
	},
	{
		resource: 'annotation',
		operation: 'delete',
		annotationId: '3f2b6c1e-8d4a-4f7b-9c2e-1a5d6e7f8a9b',
	},
	{
		resource: 'annotation',
		operation: 'getAll',
		scope: 'property',
		siteUrl: site,
		returnAll: true,
		options: dates,
	},
	{
		resource: 'indexNow',
		operation: 'submit',
		siteUrl: site,
		urls: 'https://example.com/a',
	},
	{ resource: 'indexNow', operation: 'getAll', siteUrl: site, limit: 100 },
	{
		resource: 'insight',
		operation: 'detectAnomalies',
		siteUrl: site,
		simplify: true,
		options: { days: 90, metric: 'ctr', minImpressions: 50, sensitivity: 3 },
	},
	{
		resource: 'insight',
		operation: 'findDecayingContent',
		siteUrl: site,
		limit: 100,
		simplify: true,
		sort: { sortBy: 'clickChangePct' },
		options: {
			...dates,
			...comparison,
			dimension: 'query',
			minBaselineClicks: 5,
			minImpressions: 100,
			searchType: 'web',
		},
	},
	...['findCannibalization', 'scoreOpportunities'].map((operation) => ({
		resource: 'insight',
		operation,
		siteUrl: site,
		limit: 100,
		options: { ...dates, minImpressions: 10, searchType: 'web' },
	})),
	{ resource: 'ga4', operation: 'getAll', returnAll: true },
	{
		resource: 'ga4',
		operation: 'getOverview',
		siteUrl: site,
		options: { ...dates, ...comparison, includeTimeseries: true },
	},
	{
		resource: 'ga4',
		operation: 'runReport',
		siteUrl: site,
		dimension: 'landingPage',
		limit: 50,
		options: { ...dates, ...comparison, secondaryDimension: 'date' },
	},
	{ resource: 'account', operation: 'get' },
];

function stub(params) {
	const calls = [];
	return {
		calls,
		ctx: {
			getInputData: () => [{ json: {} }],
			getNode: () => ({ name: 'GSC Wizard', type: 'gscWizard', typeVersion: 1, parameters: {} }),
			continueOnFail: () => false,
			getNodeParameter(name, _i, fallback, options) {
				let value = name in params ? params[name] : fallback;
				if (value === undefined) throw new Error(`missing parameter ${name}`);
				if (options && options.extractValue && value && typeof value === 'object')
					value = value.value;
				return value;
			},
			helpers: {
				async httpRequestWithAuthentication(_credential, options) {
					calls.push(options);
					return { pagination: { hasMore: false } };
				},
			},
		},
	};
}

const GET_ROUTES = new Set([
	'https://mcp.gscwizard.com/v1/sites',
	'https://mcp.gscwizard.com/v1/account',
]);

for (const params of CASES) {
	test(`${params.resource}: ${params.operation} sends only fields the API accepts`, async () => {
		const { ctx, calls } = stub(params);
		await new GscWizard().execute.call(ctx);
		assert.ok(calls.length > 0, 'the operation made no request');
		for (const call of calls) {
			if (call.method === 'GET') {
				assert.ok(GET_ROUTES.has(call.url), `unexpected GET ${call.url}`);
				continue;
			}
			const tool = /\/tools\/([a-z0-9_]+)$/.exec(call.url)?.[1];
			const contract = tools[tool];
			assert.ok(contract, `the API has no tool "${tool}"`);
			const sent = Object.keys(call.body);
			const unknown = sent.filter((key) => !contract.properties.includes(key));
			assert.deepEqual(unknown, [], `${tool} does not accept ${unknown.join(', ')}`);
			const missing = contract.required.filter((key) => !sent.includes(key));
			assert.deepEqual(missing, [], `${tool} requires ${missing.join(', ')}`);
		}
	});
}

test('every operation in the node description has a contract case', () => {
	const description = new GscWizard().description;
	const operationsByResource = description.properties
		.filter((p) => p.name === 'operation')
		.flatMap((p) =>
			p.displayOptions.show.resource.flatMap((resource) =>
				p.options.map((o) => `${resource}:${o.value}`),
			),
		);
	const covered = new Set(CASES.map((c) => `${c.resource}:${c.operation}`));
	const uncovered = operationsByResource.filter((key) => !covered.has(key));
	assert.deepEqual(uncovered, []);
});
