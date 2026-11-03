import type { INodeProperties } from 'n8n-workflow';
import {
	brandOption,
	comparisonEndDateOption,
	comparisonStartDateOption,
	endDateOption,
	fullResponseOption,
	limitField,
	optionsCollection,
	propertyField,
	returnAllField,
	searchTypeOption,
	showFor,
	startDateOption,
} from './shared';

const resource = 'searchPerformance';

const pagedReports = ['getTopQueries', 'getTopPages', 'getCountries'];
const allReports = [
	...pagedReports,
	'getDevices',
	'query',
	'getPagePerformance',
	'getQueryPerformance',
	'getRankingChanges',
];

export const searchPerformanceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: [
			{
				name: 'Get Countries',
				value: 'getCountries',
				description: 'Retrieve clicks, impressions, CTR and position per country',
				action: 'Get countries',
			},
			{
				name: 'Get Devices',
				value: 'getDevices',
				description: 'Retrieve clicks, impressions, CTR and position per device type',
				action: 'Get devices',
			},
			{
				name: 'Get Page Performance',
				value: 'getPagePerformance',
				description: 'Retrieve the daily clicks, impressions, CTR and position of one page',
				action: 'Get page performance',
			},
			{
				name: 'Get Query Performance',
				value: 'getQueryPerformance',
				description: 'Retrieve the daily clicks, impressions, CTR and position of one search query',
				action: 'Get query performance',
			},
			{
				name: 'Get Ranking Changes',
				value: 'getRankingChanges',
				description:
					'Find queries or pages that are new, lost, improved or declined compared with an earlier period',
				action: 'Get ranking changes',
			},
			{
				name: 'Get Top Pages',
				value: 'getTopPages',
				description: 'Retrieve the landing pages that get the most clicks from Google Search',
				action: 'Get top pages',
			},
			{
				name: 'Get Top Queries',
				value: 'getTopQueries',
				description: 'Retrieve the search queries that bring the most clicks',
				action: 'Get top queries',
			},
			{
				name: 'Query',
				value: 'query',
				description:
					'Run a custom Search Console performance report with your own dimensions and filters',
				action: 'Query search performance',
			},
		],
		default: 'getTopQueries',
	},
];

export const searchPerformanceFields: INodeProperties[] = [
	propertyField(resource, allReports),

	// Query
	{
		displayName: 'Dimensions',
		name: 'dimensions',
		type: 'multiOptions',
		options: [
			{ name: 'Country', value: 'country' },
			{ name: 'Date', value: 'date' },
			{ name: 'Device', value: 'device' },
			{ name: 'Page', value: 'page' },
			{ name: 'Query', value: 'query' },
			{ name: 'Search Appearance', value: 'searchAppearance' },
		],
		default: ['query'],
		description: 'Group rows by these dimensions (up to 4). Leave empty for site totals.',
		displayOptions: showFor(resource, ['query']),
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'fixedCollection',
		placeholder: 'Add Filter',
		typeOptions: { multipleValues: true },
		default: {},
		description: 'Only keep rows that match every filter',
		displayOptions: showFor(resource, ['query']),
		options: [
			{
				displayName: 'Filter',
				name: 'filter',
				values: [
					{
						displayName: 'Dimension',
						name: 'dimension',
						type: 'options',
						options: [
							{ name: 'Country', value: 'country' },
							{ name: 'Device', value: 'device' },
							{ name: 'Page', value: 'page' },
							{ name: 'Query', value: 'query' },
						],
						default: 'query',
					},
					{
						displayName: 'Operator',
						name: 'operator',
						type: 'options',
						options: [
							{ name: 'Contains', value: 'contains' },
							{ name: 'Does Not Contain', value: 'notContains' },
							{ name: 'Does Not Equal', value: 'notEquals' },
							{ name: 'Does Not Match Regex', value: 'excludingRegex' },
							{ name: 'Equals', value: 'equals' },
							{ name: 'Matches Regex', value: 'includingRegex' },
						],
						default: 'contains',
					},
					{
						displayName: 'Value',
						name: 'expression',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'e.g. running shoes',
						description:
							'Text or RE2 regular expression to match. Countries use ISO 3166-1 alpha-3 codes such as nld; devices are DESKTOP, MOBILE or TABLET (the case is fixed for you).',
					},
				],
			},
		],
	},

	// Page / query performance
	{
		displayName: 'Page URL',
		name: 'pageUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://www.example.com/pricing',
		description: 'Full URL of the page, as Google shows it in Search Console',
		displayOptions: showFor(resource, ['getPagePerformance']),
	},
	{
		displayName: 'Search Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. running shoes',
		description: 'The exact search query to report on',
		displayOptions: showFor(resource, ['getQueryPerformance']),
	},

	// Ranking changes
	{
		displayName: 'Change Types',
		name: 'changeTypes',
		type: 'multiOptions',
		options: [
			{ name: 'Declined', value: 'declined', description: 'Average position got worse' },
			{ name: 'Improved', value: 'improved', description: 'Average position got better' },
			{ name: 'Lost', value: 'lost', description: 'Ranked in the comparison period only' },
			{ name: 'New', value: 'new', description: 'Ranked in the date range only' },
		],
		default: ['declined', 'improved', 'lost', 'new'],
		description: 'Which kinds of change to return. Each item gets a changeType field.',
		displayOptions: showFor(resource, ['getRankingChanges']),
	},

	returnAllField(resource, [...pagedReports, 'query']),
	limitField(resource, [...pagedReports, 'query'], 100000),
	limitField(resource, ['getRankingChanges'], 10000, false),

	optionsCollection(
		resource,
		[...pagedReports, 'getDevices'],
		[brandOption, endDateOption, fullResponseOption, searchTypeOption, startDateOption],
	),
	optionsCollection(
		resource,
		['query'],
		[endDateOption, fullResponseOption, searchTypeOption, startDateOption],
	),
	optionsCollection(
		resource,
		['getPagePerformance'],
		[endDateOption, fullResponseOption, searchTypeOption, startDateOption],
	),
	optionsCollection(
		resource,
		['getQueryPerformance'],
		[
			endDateOption,
			fullResponseOption,
			{
				displayName: 'Page URL',
				name: 'pageUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://www.example.com/pricing',
				description: 'Only count the query on this page',
			},
			searchTypeOption,
			startDateOption,
		],
	),
	optionsCollection(
		resource,
		['getRankingChanges'],
		[
			comparisonEndDateOption,
			comparisonStartDateOption,
			{
				displayName: 'Compare By',
				name: 'dimension',
				type: 'options',
				options: [
					{ name: 'Page', value: 'page' },
					{ name: 'Query', value: 'query' },
				],
				default: 'query',
				description: 'Whether to compare search queries or pages',
			},
			endDateOption,
			fullResponseOption,
			searchTypeOption,
			startDateOption,
		],
	),
];
