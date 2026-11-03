import type { INodeProperties } from 'n8n-workflow';
import {
	comparisonEndDateOption,
	comparisonStartDateOption,
	endDateOption,
	fullResponseOption,
	limitField,
	optionsCollection,
	propertyField,
	returnAllField,
	showFor,
	startDateOption,
} from './shared';

const resource = 'ga4';

const ga4Dimensions = [
	{ name: 'Channel', value: 'channel' },
	{ name: 'Country', value: 'country' },
	{ name: 'Date', value: 'date' },
	{ name: 'Device', value: 'device' },
	{ name: 'Event', value: 'event' },
	{ name: 'First User Channel', value: 'firstUserChannel' },
	{ name: 'First User Source / Medium', value: 'firstUserSourceMedium' },
	{ name: 'Hostname', value: 'hostName' },
	{ name: 'Landing Page', value: 'landingPage' },
	{ name: 'Page', value: 'page' },
	{ name: 'Source / Medium', value: 'sourceMedium' },
];

export const googleAnalyticsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the GA4 properties GSC Wizard can read',
				action: 'Get many GA4 properties',
			},
			{
				name: 'Get Overview',
				value: 'getOverview',
				description:
					'Retrieve sessions, users, engagement and key events of the GA4 property linked to a Search Console property',
				action: 'Get GA4 overview',
			},
			{
				name: 'Run Report',
				value: 'runReport',
				description: 'Retrieve GA4 metrics broken down by one dimension, such as channel or page',
				action: 'Run GA4 report',
			},
		],
		default: 'getOverview',
	},
];

export const googleAnalyticsFields: INodeProperties[] = [
	propertyField(resource, ['getOverview', 'runReport']),
	{
		displayName: 'Dimension',
		name: 'dimension',
		type: 'options',
		options: ga4Dimensions,
		required: true,
		default: 'channel',
		description: 'Break the report down by this GA4 dimension',
		displayOptions: showFor(resource, ['runReport']),
	},
	returnAllField(resource, ['getAll']),
	limitField(resource, ['getAll'], 1000),
	limitField(resource, ['runReport'], 1000, false),
	optionsCollection(
		resource,
		['getOverview'],
		[
			comparisonEndDateOption,
			comparisonStartDateOption,
			endDateOption,
			{
				displayName: 'Include Daily Values',
				name: 'includeTimeseries',
				type: 'boolean',
				default: false,
				description: 'Whether to add a day-by-day series to the overview',
			},
			startDateOption,
		],
	),
	optionsCollection(
		resource,
		['runReport'],
		[
			comparisonEndDateOption,
			comparisonStartDateOption,
			endDateOption,
			fullResponseOption,
			{
				displayName: 'Secondary Dimension',
				name: 'secondaryDimension',
				type: 'options',
				options: [
					{ name: 'Date', value: 'date' },
					{ name: 'Hostname', value: 'hostName' },
				],
				default: 'date',
				description: 'Split every row further by day or by hostname',
			},
			startDateOption,
		],
	),
];
