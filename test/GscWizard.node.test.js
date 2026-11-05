// Behaviour tests for the compiled node. Run with `npm test` (builds first).
// The n8n execution context is stubbed: each test declares the node
// parameters and answers the HTTP calls the node makes, so the tests need no
// n8n instance, no network and no GSC Wizard account.
const test = require('node:test');
const assert = require('node:assert/strict');
const { GscWizard } = require('../dist/nodes/GscWizard/GscWizard.node.js');

const NODE = {
	id: 'test',
	name: 'GSC Wizard',
	type: 'n8n-nodes-gsc-wizard.gscWizard',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

function context(params, respond, { items = [{ json: {} }], continueOnFail = false } = {}) {
	const calls = [];
	const ctx = {
		getInputData: () => items,
		getNode: () => NODE,
		continueOnFail: () => continueOnFail,
		getNodeParameter(name, itemIndex, fallback, options) {
			const source = typeof params === 'function' ? params(itemIndex) : params;
			let value = name in source ? source[name] : fallback;
			if (value === undefined) throw new Error(`Test did not set parameter "${name}"`);
			if (
				options &&
				options.extractValue &&
				value &&
				typeof value === 'object' &&
				'value' in value
			) {
				value = value.value;
			}
			return value;
		},
		helpers: {
			async httpRequestWithAuthentication(credentialType, options) {
				calls.push({ credentialType, ...options });
				return respond(options, calls.length);
			},
		},
	};
	return { ctx, calls };
}

function loadOptionsContext(params, respond) {
	const calls = [];
	const ctx = {
		getNode: () => NODE,
		getNodeParameter: (name, fallback) => (name in params ? params[name] : fallback),
		helpers: {
			async httpRequestWithAuthentication(credentialType, options) {
				calls.push({ credentialType, ...options });
				return respond(options);
			},
		},
	};
	return { ctx, calls };
}

const run = (ctx) => new GscWizard().execute.call(ctx);
const site = { mode: 'list', value: 'sc-domain:example.com' };

test('top queries walk pagination.nextOffset until hasMore is false', async () => {
	const { ctx, calls } = context(
		{
			resource: 'searchPerformance',
			operation: 'getTopQueries',
			siteUrl: site,
			returnAll: true,
			options: { startDate: '2026-05-03T00:00:00', searchType: 'web' },
		},
		(options, n) =>
			n === 1
				? {
						queries: [
							{ query: 'a', clicks: 3 },
							{ query: 'b', clicks: 2 },
						],
						pagination: { hasMore: true, nextOffset: 1000 },
					}
				: { queries: [{ query: 'c', clicks: 1 }], pagination: { hasMore: false } },
	);
	const [out] = await run(ctx);
	assert.deepEqual(
		out.map((i) => i.json.query),
		['a', 'b', 'c'],
	);
	assert.equal(calls.length, 2);
	assert.equal(calls[0].url, 'https://mcp.gscwizard.com/v1/tools/query_top_queries');
	assert.equal(calls[0].method, 'POST');
	assert.equal(calls[0].credentialType, 'gscWizardApi');
	assert.deepEqual(calls[0].body, {
		siteUrl: 'sc-domain:example.com',
		startDate: '2026-05-03',
		searchType: 'web',
		limit: 1000,
		offset: 0,
	});
	assert.equal(calls[1].body.offset, 1000);
	assert.ok(out.every((i) => i.pairedItem.item === 0));
});

test('a limit below one page asks for just that many rows', async () => {
	const { ctx, calls } = context(
		{
			resource: 'searchPerformance',
			operation: 'getTopPages',
			siteUrl: site,
			returnAll: false,
			limit: 2,
			options: {},
		},
		() => ({
			pages: [{ page: '/x' }, { page: '/y' }],
			pagination: { hasMore: true, nextOffset: 2 },
		}),
	);
	const [out] = await run(ctx);
	assert.equal(out.length, 2);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].body.limit, 2);
});

test('custom query names each key after its dimension and forwards filters', async () => {
	const { ctx, calls } = context(
		{
			resource: 'searchPerformance',
			operation: 'query',
			siteUrl: { mode: 'url', value: 'https://www.example.com/' },
			dimensions: ['date', 'query'],
			filters: { filter: [{ dimension: 'country', operator: 'equals', expression: 'nld' }] },
			returnAll: false,
			limit: 50,
			options: {},
		},
		() => ({
			rows: [{ keys: ['2026-05-03', 'shoes'], clicks: 4, impressions: 40, ctr: 10, position: 2.5 }],
			pagination: { hasMore: false },
		}),
	);
	const [out] = await run(ctx);
	assert.deepEqual(out[0].json, {
		date: '2026-05-03',
		query: 'shoes',
		clicks: 4,
		impressions: 40,
		ctr: 10,
		position: 2.5,
	});
	assert.deepEqual(calls[0].body.filters, [
		{ dimension: 'country', operator: 'equals', expression: 'nld' },
	]);
	assert.equal(calls[0].body.siteUrl, 'https://www.example.com/');
	assert.equal(calls[0].body.rowLimit, 50);
	assert.equal(calls[0].body.startRow, 0);
});

test('full response returns the whole envelope as one item', async () => {
	const envelope = { queries: [{ query: 'a' }], coverage: { hiddenClicksShare: 0.2 } };
	const { ctx } = context(
		{
			resource: 'searchPerformance',
			operation: 'getTopQueries',
			siteUrl: site,
			returnAll: false,
			limit: 10,
			options: { fullResponse: true },
		},
		(options) => {
			assert.equal(options.body.fullResponse, undefined);
			return envelope;
		},
	);
	const [out] = await run(ctx);
	assert.equal(out.length, 1);
	assert.deepEqual(out[0].json, envelope);
});

test('ranking changes become one item per mover with a changeType', async () => {
	const { ctx } = context(
		{
			resource: 'searchPerformance',
			operation: 'getRankingChanges',
			siteUrl: site,
			limit: 50,
			changeTypes: ['declined', 'new'],
			options: { dimension: 'page' },
		},
		() => ({
			improved: [{ key: '/a' }],
			declined: [{ key: '/b' }],
			new: [{ key: '/c' }],
			lost: [{ key: '/d' }],
		}),
	);
	const [out] = await run(ctx);
	assert.deepEqual(
		out.map((i) => [i.json.changeType, i.json.key]),
		[
			['declined', '/b'],
			['new', '/c'],
		],
	);
});

test('URL inspection simplify keeps ten fields, but not when the quota is spent', async () => {
	const full = {
		siteUrl: 'sc-domain:example.com',
		inspectionUrl: 'https://example.com/a',
		verdict: 'PASS',
		coverageState: 'Submitted and indexed',
		robotsTxtState: 'ALLOWED',
		indexingState: 'INDEXING_ALLOWED',
		lastCrawlTime: '2026-10-01T00:00:00Z',
		pageFetchState: 'SUCCESSFUL',
		crawledAs: 'MOBILE',
		referringUrls: [],
		googleCanonical: 'https://example.com/a',
		userCanonical: 'https://example.com/a',
		inspectionResultLink: 'https://search.google.com/x',
	};
	const params = {
		resource: 'urlInspection',
		operation: 'inspect',
		siteUrl: site,
		inspectionUrl: 'https://example.com/a',
		simplify: true,
	};
	let { ctx } = context(params, () => full);
	let [out] = await run(ctx);
	assert.equal(Object.keys(out[0].json).length, 10);
	assert.equal(out[0].json.crawledAs, undefined);

	const spent = { quotaExhausted: true, message: 'Daily quota used', nextStep: 'Try tomorrow' };
	({ ctx } = context(params, () => spent));
	[out] = await run(ctx);
	assert.deepEqual(out[0].json, spent);
});

test('annotation delete confirms with deleted: true', async () => {
	const { ctx, calls } = context(
		{ resource: 'annotation', operation: 'delete', annotationId: ' 3f2b ' },
		() => ({ deleted: true, annotationId: '3f2b', label: 'Launch' }),
	);
	const [out] = await run(ctx);
	assert.equal(out.length, 1);
	assert.equal(out[0].json.deleted, true);
	assert.deepEqual(calls[0].body, { annotationId: '3f2b' });
});

test('annotation create sends a YYYY-MM-DD date and only sets siteUrl for property scope', async () => {
	const { ctx, calls } = context(
		{
			resource: 'annotation',
			operation: 'create',
			scope: 'account',
			eventDate: '2026-06-08T12:30:00',
			label: 'Launch',
			additionalFields: { color: '#ff0000', category: '' },
		},
		() => ({ annotation: { id: 'x', label: 'Launch' } }),
	);
	const [out] = await run(ctx);
	assert.deepEqual(calls[0].body, { eventDate: '2026-06-08', label: 'Launch', color: '#ff0000' });
	assert.deepEqual(out[0].json, { id: 'x', label: 'Launch' });
});

test('annotation update without fields is refused before any request', async () => {
	const { ctx, calls } = context(
		{ resource: 'annotation', operation: 'update', annotationId: 'x', updateFields: {} },
		() => ({}),
	);
	await assert.rejects(run(ctx), (error) => {
		assert.equal(error.message, 'No fields to update were set [Item 0]');
		assert.match(error.description, /Update Fields/);
		return true;
	});
	assert.equal(calls.length, 0);
});

test('an invalid date names the field and the fix', async () => {
	const { ctx } = context(
		{
			resource: 'property',
			operation: 'getSummary',
			siteUrl: site,
			options: { startDate: 'next tuesday' },
		},
		() => ({}),
	);
	await assert.rejects(run(ctx), (error) => {
		assert.match(error.message, /'Start Date'/);
		assert.match(error.message, /\[Item 0\]$/);
		assert.match(error.description, /2026-05-03/);
		return true;
	});
});

test('IndexNow submit splits a comma and newline separated list and caps it at 100', async () => {
	const { ctx, calls } = context(
		{
			resource: 'indexNow',
			operation: 'submit',
			siteUrl: site,
			urls: 'https://example.com/a,\nhttps://example.com/b  https://example.com/c',
		},
		() => ({ submitted: 3 }),
	);
	await run(ctx);
	assert.deepEqual(calls[0].body.urls, [
		'https://example.com/a',
		'https://example.com/b',
		'https://example.com/c',
	]);

	const tooMany = Array.from({ length: 101 }, (_, i) => `https://example.com/${i}`).join(',');
	const second = context(
		{ resource: 'indexNow', operation: 'submit', siteUrl: site, urls: tooMany },
		() => ({}),
	);
	await assert.rejects(run(second.ctx), /holds 101 URLs/);
});

test('the generic tool run splits rows by the listKey the API names', async () => {
	const { ctx, calls } = context(
		{
			resource: 'tool',
			operation: 'run',
			toolName: { mode: 'name', value: 'get_core_web_vitals' },
			arguments: '{"siteUrl":"sc-domain:example.com"}',
			options: {},
		},
		() => ({ listKey: 'urls', sortedBy: 'lcp', urls: [{ url: '/a' }, { url: '/b' }] }),
	);
	const [out] = await run(ctx);
	assert.equal(calls[0].url, 'https://mcp.gscwizard.com/v1/tools/get_core_web_vitals');
	assert.deepEqual(
		out.map((i) => i.json.url),
		['/a', '/b'],
	);
});

test('the generic tool run refuses arguments that are not a JSON object', async () => {
	const { ctx } = context(
		{
			resource: 'tool',
			operation: 'run',
			toolName: { mode: 'name', value: 'list_sites' },
			arguments: '[1, 2]',
			options: {},
		},
		() => ({}),
	);
	await assert.rejects(run(ctx), /must hold a JSON object \[Item 0\]/);
});

test('the account call uses the API key credential', async () => {
	const { ctx, calls } = context({ resource: 'account', operation: 'get' }, () => ({
		user: { email: 'a@example.com' },
	}));
	await run(ctx);
	assert.equal(calls[0].credentialType, 'gscWizardApi');
	assert.equal(calls[0].method, 'GET');
	assert.equal(calls[0].url, 'https://mcp.gscwizard.com/v1/account');
});

test('the node offers the API key credential and no Authentication selector', () => {
	const { description } = new GscWizard();
	assert.deepEqual(
		description.credentials.map((c) => c.name),
		['gscWizardApi'],
	);
	assert.equal(description.credentials[0].displayOptions, undefined);
	assert.ok(!description.properties.some((p) => p.name === 'authentication'));
});

function httpError(status, body) {
	const error = new Error(`Request failed with status code ${status}`);
	error.response = { status, data: body };
	return error;
}

test('a 402 from the API says the plan lapsed and where to renew', async () => {
	const { ctx } = context({ resource: 'account', operation: 'get' }, () => {
		throw httpError(402, { error: { code: 'payment_required', message: 'Your trial has ended.' } });
	});
	await assert.rejects(run(ctx), (error) => {
		assert.equal(error.message, 'The GSC Wizard account has no active plan [Item 0]');
		assert.match(error.description, /Your trial has ended\./);
		assert.match(error.description, /settings\/subscription/);
		assert.equal(error.httpCode, '402');
		return true;
	});
});

test('a 403 passes the API reason and next step through', async () => {
	const { ctx } = context(
		{ resource: 'sitemap', operation: 'getAll', siteUrl: site, returnAll: true },
		() => {
			throw httpError(403, {
				error: {
					code: 'forbidden',
					message: 'Property not verified.',
					nextStep: 'Verify it in Search Console.',
				},
			});
		},
	);
	await assert.rejects(run(ctx), (error) => {
		assert.equal(error.message, 'GSC Wizard refused access [Item 0]');
		assert.equal(error.description, 'Property not verified. Verify it in Search Console.');
		return true;
	});
});

test('continue on fail turns a failed item into an error item and keeps going', async () => {
	const { ctx } = context(
		{ resource: 'account', operation: 'get' },
		(options, n) => {
			if (n === 1) throw httpError(429, { error: { code: 'rate_limited', message: 'Slow down.' } });
			return { user: { id: 'u' } };
		},
		{ items: [{ json: {} }, { json: {} }], continueOnFail: true },
	);
	const [out] = await run(ctx);
	assert.equal(out.length, 2);
	assert.equal(out[0].json.error, 'GSC Wizard rate limit reached [Item 0]');
	assert.equal(out[0].pairedItem.item, 0);
	assert.deepEqual(out[1].json, { user: { id: 'u' } });
	assert.equal(out[1].pairedItem.item, 1);
});

test('the property list search filters and flags properties that cannot be read', async () => {
	const { ctx, calls } = loadOptionsContext({}, () => ({
		sites: [
			{ siteUrl: 'sc-domain:example.com', readable: true, activated: true },
			{ siteUrl: 'https://shop.example.com/', readable: true, activated: false },
			{ siteUrl: 'https://other.org/', readable: false, activated: false },
		],
	}));
	const node = new GscWizard();
	const { results } = await node.methods.listSearch.searchProperties.call(ctx, 'EXAMPLE');
	assert.deepEqual(results, [
		{ name: 'sc-domain:example.com', value: 'sc-domain:example.com' },
		{
			name: 'https://shop.example.com/ (not activated in GSC Wizard)',
			value: 'https://shop.example.com/',
		},
	]);
	assert.equal(calls[0].url, 'https://mcp.gscwizard.com/v1/sites');
	assert.equal(calls[0].credentialType, 'gscWizardApi');
});

test('the tool list search shows the title and the tool name', async () => {
	const { ctx } = loadOptionsContext({}, () => ({
		tools: [
			{ name: 'get_core_web_vitals', title: 'Core Web Vitals' },
			{ name: 'list_sites', title: 'List properties' },
		],
	}));
	const { results } = await new GscWizard().methods.listSearch.searchTools.call(ctx, 'vitals');
	assert.deepEqual(results, [
		{ name: 'Core Web Vitals (get_core_web_vitals)', value: 'get_core_web_vitals' },
	]);
});

test('property list simplify drops connection details but keeps readability flags', async () => {
	const row = {
		siteUrl: 'sc-domain:example.com',
		tags: ['shop'],
		dataSource: 'GSC',
		ga4PropertyId: null,
		permissionLevel: 'siteOwner',
		readable: true,
		activated: true,
		faviconUrl: 'https://x/icon.png',
		connectedAt: '2026-01-01T00:00:00Z',
		gscScope: 'full',
		sharedBy: 'owner@example.com',
		accessLevel: 'READ_ONLY',
	};
	const params = { resource: 'property', operation: 'getAll', returnAll: true, simplify: true };
	let { ctx } = context(params, () => ({ sites: [row] }));
	let [out] = await run(ctx);
	assert.equal(Object.keys(out[0].json).length, 10);
	assert.equal(out[0].json.readable, true);
	assert.equal(out[0].json.connectedAt, undefined);

	({ ctx } = context({ ...params, simplify: false }, () => ({ sites: [row] })));
	[out] = await run(ctx);
	assert.deepEqual(out[0].json, row);
});

test('device and country filters are put in the case Search Console stores them in', async () => {
	const { ctx, calls } = context(
		{
			resource: 'searchPerformance',
			operation: 'query',
			siteUrl: site,
			dimensions: ['device'],
			filters: {
				filter: [
					{ dimension: 'device', operator: 'equals', expression: ' mobile ' },
					{ dimension: 'country', operator: 'notEquals', expression: 'USA' },
					{ dimension: 'device', operator: 'includingRegex', expression: '(?i)mob' },
					{ dimension: 'query', operator: 'contains', expression: 'Shoes' },
				],
			},
			returnAll: false,
			limit: 5,
			options: {},
		},
		() => ({ rows: [], pagination: { hasMore: false } }),
	);
	await run(ctx);
	assert.deepEqual(
		calls[0].body.filters.map((f) => f.expression),
		['MOBILE', 'usa', '(?i)mob', 'Shoes'],
	);
});

test('a GA4 report on a property without GA4 says so instead of returning nothing', async () => {
	const notLinked = {
		siteUrl: 'sc-domain:example.com',
		notConfigured: true,
		reason: 'no_property',
		hint: 'Link a GA4 property to this site in GSC Wizard.',
	};
	for (const operation of ['runReport', 'getOverview']) {
		const { ctx } = context(
			{ resource: 'ga4', operation, siteUrl: site, dimension: 'channel', limit: 5, options: {} },
			() => notLinked,
		);
		await assert.rejects(run(ctx), (error) => {
			assert.equal(
				error.message,
				'The data source for this report is not set up for the property [Item 0]',
			);
			assert.equal(error.description, 'Link a GA4 property to this site in GSC Wizard.');
			return true;
		});
	}
});
