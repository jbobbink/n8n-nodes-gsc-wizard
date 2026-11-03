import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INode,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { accountOperations } from './descriptions/account';
import { annotationFields, annotationOperations } from './descriptions/annotation';
import { googleAnalyticsFields, googleAnalyticsOperations } from './descriptions/googleAnalytics';
import { indexNowFields, indexNowOperations } from './descriptions/indexNow';
import { insightFields, insightOperations } from './descriptions/insight';
import { propertyFields, propertyOperations } from './descriptions/property';
import {
	searchPerformanceFields,
	searchPerformanceOperations,
} from './descriptions/searchPerformance';
import { sitemapFields, sitemapOperations } from './descriptions/sitemap';
import { toolFields, toolOperations } from './descriptions/tool';
import { urlInspectionFields, urlInspectionOperations } from './descriptions/urlInspection';
import type { Paging } from './transport';
import { gscWizardApiRequest, runTool, runToolPaged } from './transport';

const DATE_OPTIONS = new Set(['startDate', 'endDate', 'comparisonStartDate', 'comparisonEndDate']);

const DATE_LABELS: Record<string, string> = {
	startDate: 'Start Date',
	endDate: 'End Date',
	comparisonStartDate: 'Comparison Start Date',
	comparisonEndDate: 'Comparison End Date',
	eventDate: 'Date',
};

/** Report operations that page with limit/offset, and the field each one lists its rows in. */
const PAGED_REPORTS: Record<string, { tool: string; listKey: string }> = {
	getTopQueries: { tool: 'query_top_queries', listKey: 'queries' },
	getTopPages: { tool: 'query_top_pages', listKey: 'pages' },
	getCountries: { tool: 'query_countries', listKey: 'countries' },
};

const REPORT_PAGING: Paging = { limitKey: 'limit', offsetKey: 'offset', pageSize: 1000 };
const QUERY_PAGING: Paging = { limitKey: 'rowLimit', offsetKey: 'startRow', pageSize: 25000 };
const INSPECTION_PAGING: Paging = { limitKey: 'limit', offsetKey: 'offset', pageSize: 500 };

const RANKING_CHANGE_TYPES = ['improved', 'declined', 'new', 'lost'];

const SIMPLE_INSPECTION = [
	'inspectionUrl',
	'verdict',
	'coverageState',
	'indexingState',
	'lastCrawlTime',
	'pageFetchState',
	'robotsTxtState',
	'googleCanonical',
	'userCanonical',
	'inspectionResultLink',
];
const SIMPLE_STORED_INSPECTION = [
	'url',
	'verdict',
	'coverage_state',
	'indexing_state',
	'last_crawl_time',
	'page_fetch_state',
	'google_canonical',
	'user_canonical',
	'requested_at',
	'id',
];
const SIMPLE_PROPERTY = [
	'siteUrl',
	'activated',
	'readable',
	'permissionLevel',
	'gscScope',
	'dataSource',
	'tags',
	'ga4PropertyId',
	'sharedBy',
	'accessLevel',
];
const SIMPLE_ANOMALY = [
	'date',
	'metric',
	'actual',
	'expected',
	'deviationPercent',
	'severity',
	'direction',
	'outcome',
	'clicks',
	'impressions',
];
const SIMPLE_DECAY = [
	'key',
	'clicksLost',
	'clickChangePct',
	'recentClicks',
	'baselineClicks',
	'recentPosition',
	'baselinePosition',
	'positionDelta',
	'severity',
	'pattern',
];

/** A configuration mistake: what is wrong in `message`, how to fix it in `description`. */
function invalidInput(
	node: INode,
	message: string,
	description: string,
	itemIndex: number,
): NodeOperationError {
	return new NodeOperationError(node, `${message} [Item ${itemIndex}]`, { itemIndex, description });
}

/**
 * Search Console stores devices in upper case (MOBILE) and countries as lower-case
 * ISO 3166-1 alpha-3 codes (usa), and matches filters case-sensitively, so a
 * plain-text device or country filter is put in that case. Regex filters are
 * left as written.
 */
function normalizeFilterValue(dimension: string, operator: string, expression: string): string {
	if (operator === 'includingRegex' || operator === 'excludingRegex') return expression;
	if (dimension === 'device') return expression.trim().toUpperCase();
	if (dimension === 'country') return expression.trim().toLowerCase();
	return expression;
}

/** GA4 (or another source) is not linked: the API answers with `notConfigured` and a hint instead of data. */
function notConfiguredError(
	node: INode,
	response: IDataObject,
	itemIndex: number,
): NodeOperationError | undefined {
	if (response.notConfigured !== true) return undefined;
	return invalidInput(
		node,
		'The data source for this report is not set up for the property',
		String(
			response.hint ??
				response.reason ??
				'Link the data source to the property in GSC Wizard, then run the node again.',
		),
		itemIndex,
	);
}

function pick(row: IDataObject, fields: string[]): IDataObject {
	const out: IDataObject = {};
	for (const field of fields) {
		if (row[field] !== undefined) out[field] = row[field];
	}
	return out;
}

function listOf(response: IDataObject, key: string): IDataObject[] {
	const value = response[key];
	return Array.isArray(value) ? (value as IDataObject[]) : [];
}

export class GscWizard implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GSC Wizard',
		name: 'gscWizard',
		icon: { light: 'file:../../icons/gscWizard.svg', dark: 'file:../../icons/gscWizard.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Read Google Search Console and GA4 data, inspect URLs, submit sitemaps and IndexNow URLs, and manage annotations with GSC Wizard',
		defaults: {
			name: 'GSC Wizard',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'gscWizardApi',
				required: true,
				displayOptions: { show: { authentication: ['apiKey'] } },
			},
			{
				name: 'gscWizardOAuth2Api',
				required: true,
				displayOptions: { show: { authentication: ['oAuth2'] } },
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{ name: 'API Key', value: 'apiKey' },
					{ name: 'OAuth2', value: 'oAuth2' },
				],
				default: 'apiKey',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Annotation', value: 'annotation' },
					{ name: 'GA4', value: 'ga4' },
					{ name: 'IndexNow', value: 'indexNow' },
					{ name: 'Insight', value: 'insight' },
					{ name: 'Property', value: 'property' },
					{ name: 'Search Performance', value: 'searchPerformance' },
					{ name: 'Sitemap', value: 'sitemap' },
					{ name: 'Tool', value: 'tool' },
					{ name: 'URL Inspection', value: 'urlInspection' },
				],
				default: 'searchPerformance',
			},
			...accountOperations,
			...annotationOperations,
			...annotationFields,
			...googleAnalyticsOperations,
			...googleAnalyticsFields,
			...indexNowOperations,
			...indexNowFields,
			...insightOperations,
			...insightFields,
			...propertyOperations,
			...propertyFields,
			...searchPerformanceOperations,
			...searchPerformanceFields,
			...sitemapOperations,
			...sitemapFields,
			...toolOperations,
			...toolFields,
			...urlInspectionOperations,
			...urlInspectionFields,
		],
	};

	methods = {
		listSearch: {
			async searchProperties(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const response = await gscWizardApiRequest.call(this, 'GET', '/sites');
				const needle = (filter ?? '').toLowerCase();
				const results = listOf(response, 'sites')
					.filter((site) =>
						String(site.siteUrl ?? '')
							.toLowerCase()
							.includes(needle),
					)
					.map((site) => {
						const siteUrl = String(site.siteUrl);
						let name = siteUrl;
						if (site.readable === false) name += ' (not verified in Search Console)';
						else if (site.activated === false) name += ' (not activated in GSC Wizard)';
						return { name, value: siteUrl };
					});
				return { results };
			},

			async searchTools(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const response = await gscWizardApiRequest.call(this, 'GET', '/tools');
				const needle = (filter ?? '').toLowerCase();
				const results = listOf(response, 'tools')
					.filter((tool) => `${tool.name ?? ''} ${tool.title ?? ''}`.toLowerCase().includes(needle))
					.map((tool) => ({
						name: tool.title ? `${String(tool.title)} (${String(tool.name)})` : String(tool.name),
						value: String(tool.name),
					}));
				return { results };
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const toDate = (value: unknown, field: string, itemIndex: number): string => {
			const text =
				value instanceof Date
					? value.toISOString()
					: typeof value === 'object' && value !== null && 'toISO' in value
						? String((value as { toISO: () => string }).toISO())
						: String(value ?? '');
			const date = text.trim().slice(0, 10);
			if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
				throw invalidInput(
					this.getNode(),
					`The '${DATE_LABELS[field] ?? field}' value "${text}" is not a date`,
					'Pick a day in the date picker or enter a date such as 2026-05-03.',
					itemIndex,
				);
			}
			return date;
		};

		/** The Options collection as API arguments: dates as YYYY-MM-DD, empty values and node-only switches dropped. */
		const apiOptions = (itemIndex: number, name = 'options'): IDataObject => {
			const options = this.getNodeParameter(name, itemIndex, {}) as IDataObject;
			const args: IDataObject = {};
			for (const [key, value] of Object.entries(options)) {
				if (key === 'fullResponse' || value === '' || value === undefined || value === null)
					continue;
				args[key] =
					DATE_OPTIONS.has(key) || key === 'eventDate' ? toDate(value, key, itemIndex) : value;
			}
			return args;
		};

		const fullResponse = (itemIndex: number): boolean =>
			Boolean((this.getNodeParameter('options', itemIndex, {}) as IDataObject).fullResponse);

		const site = (itemIndex: number): string =>
			(this.getNodeParameter('siteUrl', itemIndex, '', { extractValue: true }) as string).trim();

		const urlList = (name: string, label: string, max: number, itemIndex: number): string[] => {
			const raw = this.getNodeParameter(name, itemIndex) as string | string[];
			const urls = (Array.isArray(raw) ? raw : String(raw).split(/[\s,]+/))
				.map((u) => String(u).trim())
				.filter((u) => u.length > 0);
			if (urls.length === 0 || urls.length > max) {
				throw invalidInput(
					this.getNode(),
					`The '${label}' field holds ${urls.length} URLs`,
					`Enter between 1 and ${max} full URLs, separated by commas or new lines.`,
					itemIndex,
				);
			}
			return urls;
		};

		const takeLimit = (rows: IDataObject[], itemIndex: number): IDataObject[] => {
			if (this.getNodeParameter('returnAll', itemIndex, false) as boolean) return rows;
			return rows.slice(0, this.getNodeParameter('limit', itemIndex, 50) as number);
		};

		const simplifyRows = (
			rows: IDataObject[],
			fields: string[],
			itemIndex: number,
		): IDataObject[] =>
			(this.getNodeParameter('simplify', itemIndex, true) as boolean)
				? rows.map((row) => pick(row, fields))
				: rows;

		/** A list-shaped report: one item per row, or the whole response when 'Full Response' is on. */
		const listReport = async (
			tool: string,
			args: IDataObject,
			listKey: string,
			itemIndex: number,
			simplify?: string[],
		): Promise<IDataObject[]> => {
			const response = await runTool.call(this, tool, args, itemIndex);
			if (fullResponse(itemIndex)) return [response];
			const notConfigured = notConfiguredError(this.getNode(), response, itemIndex);
			if (notConfigured) throw notConfigured;
			const rows = listOf(response, listKey);
			return simplify ? simplifyRows(rows, simplify, itemIndex) : rows;
		};

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let results: IDataObject[];

				if (resource === 'property') {
					if (operation === 'getAll') {
						const response = await gscWizardApiRequest.call(this, 'GET', '/sites', undefined, i);
						results = simplifyRows(takeLimit(listOf(response, 'sites'), i), SIMPLE_PROPERTY, i);
					} else {
						results = [
							await runTool.call(
								this,
								'get_site_summary',
								{ siteUrl: site(i), ...apiOptions(i) },
								i,
							),
						];
					}
				} else if (resource === 'searchPerformance') {
					const siteUrl = site(i);
					const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
					const limit = this.getNodeParameter('limit', i, 50) as number;

					if (PAGED_REPORTS[operation]) {
						const { tool, listKey } = PAGED_REPORTS[operation];
						const args = { siteUrl, ...apiOptions(i) };
						results = fullResponse(i)
							? [
									await runTool.call(
										this,
										tool,
										{ ...args, limit: returnAll ? 1000 : Math.min(limit, 1000) },
										i,
									),
								]
							: await runToolPaged.call(
									this,
									tool,
									args,
									listKey,
									REPORT_PAGING,
									returnAll,
									limit,
									i,
								);
					} else if (operation === 'getDevices') {
						// Three rows at most (desktop, mobile, tablet), so the tool takes no paging.
						results = await listReport(
							'query_devices',
							{ siteUrl, ...apiOptions(i) },
							'devices',
							i,
						);
					} else if (operation === 'query') {
						const dimensions = this.getNodeParameter('dimensions', i, []) as string[];
						if (dimensions.length > 4) {
							throw invalidInput(
								this.getNode(),
								`The 'Dimensions' field has ${dimensions.length} values`,
								'Pick at most 4 dimensions.',
								i,
							);
						}
						const filterValues =
							((this.getNodeParameter('filters', i, {}) as IDataObject).filter as IDataObject[]) ??
							[];
						const args: IDataObject = {
							siteUrl,
							dimensions,
							filters: filterValues.map((f) => ({
								dimension: f.dimension,
								operator: f.operator,
								expression: normalizeFilterValue(
									String(f.dimension),
									String(f.operator),
									String(f.expression ?? ''),
								),
							})),
							...apiOptions(i),
						};
						if (fullResponse(i)) {
							results = [
								await runTool.call(
									this,
									'query_search_analytics',
									{ ...args, rowLimit: returnAll ? 25000 : Math.min(limit, 25000) },
									i,
								),
							];
						} else {
							const rows = await runToolPaged.call(
								this,
								'query_search_analytics',
								args,
								'rows',
								QUERY_PAGING,
								returnAll,
								limit,
								i,
							);
							// `keys` is positional; name each value after its dimension.
							results = rows.map((row) => {
								const { keys, ...metrics } = row;
								const named: IDataObject = {};
								(Array.isArray(keys) ? keys : []).forEach((value, index) => {
									named[dimensions[index] ?? `key${index}`] = value as string;
								});
								return { ...named, ...metrics };
							});
						}
					} else if (operation === 'getPagePerformance') {
						const pageUrl = (this.getNodeParameter('pageUrl', i) as string).trim();
						results = await listReport(
							'get_page_performance',
							{ siteUrl, pageUrl, ...apiOptions(i) },
							'daily',
							i,
						);
					} else if (operation === 'getQueryPerformance') {
						const query = (this.getNodeParameter('query', i) as string).trim();
						results = await listReport(
							'get_query_performance',
							{ siteUrl, query, ...apiOptions(i) },
							'daily',
							i,
						);
					} else {
						const response = await runTool.call(
							this,
							'get_ranking_changes',
							{ siteUrl, limit, ...apiOptions(i) },
							i,
						);
						if (fullResponse(i)) {
							results = [response];
						} else {
							const wanted = this.getNodeParameter(
								'changeTypes',
								i,
								RANKING_CHANGE_TYPES,
							) as string[];
							results = RANKING_CHANGE_TYPES.filter((type) => wanted.includes(type)).flatMap(
								(type) => listOf(response, type).map((row) => ({ changeType: type, ...row })),
							);
						}
					}
				} else if (resource === 'urlInspection') {
					const siteUrl = site(i);
					if (operation === 'inspect') {
						const inspectionUrl = (this.getNodeParameter('inspectionUrl', i) as string).trim();
						const response = await runTool.call(this, 'inspect_url', { siteUrl, inspectionUrl }, i);
						const simplify = this.getNodeParameter('simplify', i, true) as boolean;
						// A spent daily quota answers with an explanation instead of a verdict; keep it whole.
						results = [
							simplify && !response.quotaExhausted ? pick(response, SIMPLE_INSPECTION) : response,
						];
					} else if (operation === 'getAll') {
						const rows = await runToolPaged.call(
							this,
							'list_url_inspections',
							{ siteUrl, ...apiOptions(i) },
							'inspections',
							INSPECTION_PAGING,
							this.getNodeParameter('returnAll', i, false) as boolean,
							this.getNodeParameter('limit', i, 100) as number,
							i,
						);
						results = simplifyRows(rows, SIMPLE_STORED_INSPECTION, i);
					} else {
						results = [await runTool.call(this, 'get_inspection_quota', { siteUrl }, i)];
					}
				} else if (resource === 'sitemap') {
					const siteUrl = site(i);
					if (operation === 'getAll') {
						const response = await runTool.call(this, 'list_sitemaps', { siteUrl }, i);
						results = takeLimit(listOf(response, 'sitemaps'), i);
					} else {
						const sitemapUrls = urlList('sitemapUrls', 'Sitemap URLs', 20, i);
						results = [await runTool.call(this, 'submit_sitemap', { siteUrl, sitemapUrls }, i)];
					}
				} else if (resource === 'annotation') {
					if (operation === 'create') {
						const scope = this.getNodeParameter('scope', i) as string;
						const args: IDataObject = {
							eventDate: toDate(this.getNodeParameter('eventDate', i), 'eventDate', i),
							label: (this.getNodeParameter('label', i) as string).trim(),
							...apiOptions(i, 'additionalFields'),
						};
						if (scope === 'property') args.siteUrl = site(i);
						const response = await runTool.call(this, 'create_annotation', args, i);
						results = [(response.annotation as IDataObject) ?? response];
					} else if (operation === 'update') {
						const fields = apiOptions(i, 'updateFields');
						if (Object.keys(fields).length === 0) {
							throw invalidInput(
								this.getNode(),
								`No fields to update were set`,
								"Add at least one field under 'Update Fields'.",
								i,
							);
						}
						const annotationId = (this.getNodeParameter('annotationId', i) as string).trim();
						const response = await runTool.call(
							this,
							'update_annotation',
							{ annotationId, ...fields },
							i,
						);
						results = [(response.annotation as IDataObject) ?? response];
					} else if (operation === 'delete') {
						const annotationId = (this.getNodeParameter('annotationId', i) as string).trim();
						const response = await runTool.call(this, 'delete_annotation', { annotationId }, i);
						results = [{ ...response, deleted: true }];
					} else {
						const scope = this.getNodeParameter('scope', i) as string;
						const args: IDataObject = { ...apiOptions(i) };
						if (scope === 'property') args.siteUrl = site(i);
						const response = await runTool.call(this, 'list_annotations', args, i);
						results = takeLimit(listOf(response, 'annotations'), i);
					}
				} else if (resource === 'indexNow') {
					const siteUrl = site(i);
					if (operation === 'submit') {
						const urls = urlList('urls', 'URLs', 100, i);
						results = [await runTool.call(this, 'submit_indexnow_urls', { siteUrl, urls }, i)];
					} else {
						const limit = this.getNodeParameter('limit', i, 100) as number;
						const response = await runTool.call(
							this,
							'list_indexnow_submissions',
							{ siteUrl, limit },
							i,
						);
						results = listOf(response, 'submissions');
					}
				} else if (resource === 'insight') {
					const siteUrl = site(i);
					if (operation === 'detectAnomalies') {
						results = await listReport(
							'detect_anomalies',
							{ siteUrl, ...apiOptions(i) },
							'anomalies',
							i,
							SIMPLE_ANOMALY,
						);
					} else {
						const limit = this.getNodeParameter('limit', i, 100) as number;
						if (operation === 'findDecayingContent') {
							results = await listReport(
								'find_decaying_content',
								{ siteUrl, limit, ...apiOptions(i), ...apiOptions(i, 'sort') },
								'decaying',
								i,
								SIMPLE_DECAY,
							);
						} else if (operation === 'findCannibalization') {
							results = await listReport(
								'analyze_cannibalization',
								{ siteUrl, limit, ...apiOptions(i) },
								'cannibalized',
								i,
							);
						} else {
							results = await listReport(
								'score_opportunities',
								{ siteUrl, limit, ...apiOptions(i) },
								'opportunities',
								i,
							);
						}
					}
				} else if (resource === 'ga4') {
					if (operation === 'getAll') {
						const response = await runTool.call(this, 'list_ga4_properties', {}, i);
						results = takeLimit(listOf(response, 'properties'), i);
					} else if (operation === 'getOverview') {
						const response = await runTool.call(
							this,
							'get_ga4_overview',
							{ siteUrl: site(i), ...apiOptions(i) },
							i,
						);
						const notConfigured = notConfiguredError(this.getNode(), response, i);
						if (notConfigured) throw notConfigured;
						results = [response];
					} else {
						results = await listReport(
							'query_ga4_report',
							{
								siteUrl: site(i),
								dimension: this.getNodeParameter('dimension', i) as string,
								limit: this.getNodeParameter('limit', i, 50) as number,
								...apiOptions(i),
							},
							'rows',
							i,
						);
					}
				} else if (resource === 'account') {
					results = [await gscWizardApiRequest.call(this, 'GET', '/account', undefined, i)];
				} else if (resource === 'tool') {
					const toolName = (
						this.getNodeParameter('toolName', i, '', { extractValue: true }) as string
					).trim();
					const raw = this.getNodeParameter('arguments', i, '{}') as string | IDataObject;
					let args: unknown = raw;
					if (typeof raw === 'string') {
						try {
							args = raw.trim() === '' ? {} : JSON.parse(raw);
						} catch {
							throw invalidInput(
								this.getNode(),
								`The 'Arguments (JSON)' field is not valid JSON`,
								'Enter a JSON object such as {"siteUrl": "sc-domain:example.com"}.',
								i,
							);
						}
					}
					if (typeof args !== 'object' || args === null || Array.isArray(args)) {
						throw invalidInput(
							this.getNode(),
							`The 'Arguments (JSON)' field must hold a JSON object`,
							'Wrap the arguments in curly braces, or use {} for a tool without input.',
							i,
						);
					}
					const response = await runTool.call(this, toolName, args as IDataObject, i);
					const listKey = response.listKey;
					results =
						!fullResponse(i) && typeof listKey === 'string' && Array.isArray(response[listKey])
							? listOf(response, listKey)
							: [response];
				} else {
					throw invalidInput(
						this.getNode(),
						`The resource "${resource}" is not supported`,
						"Pick another option in the 'Resource' field.",
						i,
					);
				}

				for (const json of results) {
					returnData.push({ json, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
