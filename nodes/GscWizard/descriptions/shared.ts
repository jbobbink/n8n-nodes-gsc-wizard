import type { IDisplayOptions, INodeProperties, INodePropertyOptions } from 'n8n-workflow';

export function showFor(resource: string, operations: string[]): IDisplayOptions {
	return { show: { resource: [resource], operation: operations } };
}

export function propertyField(
	resource: string,
	operations: string[],
	extraShow: IDisplayOptions['show'] = {},
): INodeProperties {
	return {
		displayName: 'Property',
		name: 'siteUrl',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The Search Console property, as connected in GSC Wizard',
		displayOptions: { show: { resource: [resource], operation: operations, ...extraShow } },
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchProperties', searchable: true },
			},
			{
				displayName: 'By URL',
				name: 'url',
				type: 'string',
				placeholder: 'e.g. sc-domain:example.com',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^(sc-domain:\\S+|https?://\\S+)$',
							errorMessage:
								'Enter a domain property such as sc-domain:example.com or a URL-prefix property such as https://www.example.com/',
						},
					},
				],
			},
		],
	};
}

export const searchTypeOptions: INodePropertyOptions[] = [
	{ name: 'All', value: 'all', description: 'Web, image, video, news and Discover combined' },
	{ name: 'Discover', value: 'discover' },
	{ name: 'Google News', value: 'googleNews', description: 'Traffic from news.google.com' },
	{ name: 'Image', value: 'image' },
	{ name: 'News', value: 'news', description: 'The News tab in Google Search' },
	{ name: 'Video', value: 'video' },
	{ name: 'Web', value: 'web' },
];

export const searchTypeOption: INodeProperties = {
	displayName: 'Search Type',
	name: 'searchType',
	type: 'options',
	options: searchTypeOptions,
	default: 'web',
	description: 'Which Google search surface to report on',
};

export const startDateOption: INodeProperties = {
	displayName: 'Start Date',
	name: 'startDate',
	type: 'dateTime',
	default: '',
	description:
		'First day of the date range. Leave out both dates to use the last 28 days with settled data.',
};

export const endDateOption: INodeProperties = {
	displayName: 'End Date',
	name: 'endDate',
	type: 'dateTime',
	default: '',
	description:
		'Last day of the date range. Leave it out to end on the latest day Search Console has settled data for (data lags 2 to 3 days).',
};

export const comparisonStartDateOption: INodeProperties = {
	displayName: 'Comparison Start Date',
	name: 'comparisonStartDate',
	type: 'dateTime',
	default: '',
	description:
		'First day of the period to compare against. Leave out both comparison dates to compare with the period just before the date range.',
};

export const comparisonEndDateOption: INodeProperties = {
	displayName: 'Comparison End Date',
	name: 'comparisonEndDate',
	type: 'dateTime',
	default: '',
	description: 'Last day of the period to compare against',
};

export const brandOption: INodeProperties = {
	displayName: 'Brand Filter',
	name: 'brand',
	type: 'options',
	options: [
		{
			name: 'Branded Queries',
			value: 'branded',
			description: "Only queries that match the property's branded keywords",
		},
		{ name: 'Non-Branded Queries', value: 'non_branded', description: 'Every other query' },
	],
	default: 'non_branded',
	description:
		'Narrow the report to branded or non-branded queries. Needs branded keywords set on the property in GSC Wizard.',
};

export const minImpressionsOption: INodeProperties = {
	displayName: 'Minimum Impressions',
	name: 'minImpressions',
	type: 'number',
	typeOptions: { minValue: 0 },
	default: 10,
	description: 'Leave out rows with fewer impressions than this',
};

export const fullResponseOption: INodeProperties = {
	displayName: 'Full Response',
	name: 'fullResponse',
	type: 'boolean',
	default: false,
	description:
		'Whether to return the whole response as one item, including totals, coverage and freshness details, instead of one item per row',
};

export function returnAllField(resource: string, operations: string[]): INodeProperties {
	return {
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: showFor(resource, operations),
	};
}

export function limitField(
	resource: string,
	operations: string[],
	maxValue: number,
	withReturnAll = true,
): INodeProperties {
	return {
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: withReturnAll
			? { show: { resource: [resource], operation: operations, returnAll: [false] } }
			: showFor(resource, operations),
	};
}

export function simplifyField(resource: string, operations: string[]): INodeProperties {
	return {
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		description: 'Whether to return a simplified version of the response instead of the raw data',
		displayOptions: showFor(resource, operations),
	};
}

export function optionsCollection(
	resource: string,
	operations: string[],
	options: INodeProperties[],
): INodeProperties {
	return {
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(resource, operations),
		options,
	};
}
