import type { INodeProperties } from 'n8n-workflow';
import {
	comparisonEndDateOption,
	comparisonStartDateOption,
	endDateOption,
	fullResponseOption,
	limitField,
	minImpressionsOption,
	optionsCollection,
	propertyField,
	searchTypeOption,
	showFor,
	simplifyField,
	startDateOption,
} from './shared';

const resource = 'insight';

const rankedFindings = ['findDecayingContent', 'findCannibalization', 'scoreOpportunities'];

export const insightOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: [
			{
				name: 'Detect Anomalies',
				value: 'detectAnomalies',
				description:
					'Find days where clicks, impressions, CTR or position broke from the normal range',
				action: 'Detect traffic anomalies',
			},
			{
				name: 'Find Cannibalization',
				value: 'findCannibalization',
				description: 'Find search queries where several of your pages compete for the same clicks',
				action: 'Find keyword cannibalization',
			},
			{
				name: 'Find Decaying Content',
				value: 'findDecayingContent',
				description: 'Find pages or queries that lost clicks compared with an earlier period',
				action: 'Find decaying content',
			},
			{
				name: 'Score Opportunities',
				value: 'scoreOpportunities',
				description: 'Rank queries by how many extra clicks a better position or CTR could bring',
				action: 'Score query opportunities',
			},
		],
		default: 'detectAnomalies',
	},
];

export const insightFields: INodeProperties[] = [
	propertyField(resource, ['detectAnomalies', ...rankedFindings]),
	limitField(resource, rankedFindings, 1000, false),
	simplifyField(resource, ['detectAnomalies', 'findDecayingContent']),

	optionsCollection(
		resource,
		['detectAnomalies'],
		[
			{
				displayName: 'Days',
				name: 'days',
				type: 'number',
				typeOptions: { minValue: 21, maxValue: 480 },
				default: 90,
				description: 'How many trailing days of daily data to scan',
			},
			fullResponseOption,
			{
				displayName: 'Metric',
				name: 'metric',
				type: 'options',
				options: [
					{ name: 'Clicks', value: 'clicks' },
					{ name: 'CTR', value: 'ctr' },
					{ name: 'Impressions', value: 'impressions' },
					{ name: 'Position', value: 'position' },
				],
				default: 'clicks',
				description: 'Which metric to scan',
			},
			{
				displayName: 'Minimum Impressions',
				name: 'minImpressions',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description:
					'For CTR and position only: days with fewer impressions than this are marked as low volume',
			},
			{
				displayName: 'Sensitivity',
				name: 'sensitivity',
				type: 'number',
				typeOptions: { minValue: 2, maxValue: 6, numberPrecision: 1 },
				default: 3.5,
				description: 'Lower values report more anomalies. 3 to 4 suits most sites.',
			},
		],
	),

	optionsCollection(
		resource,
		['findDecayingContent'],
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
				default: 'page',
				description: 'Whether to look for decaying pages or decaying search queries',
			},
			endDateOption,
			fullResponseOption,
			{
				displayName: 'Minimum Baseline Clicks',
				name: 'minBaselineClicks',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 5,
				description: 'Ignore pages or queries with fewer clicks than this in the comparison period',
			},
			{
				...minImpressionsOption,
				default: 100,
				description:
					'Ignore pages or queries with fewer impressions than this in the comparison period',
			},
			searchTypeOption,
			startDateOption,
		],
	),

	{
		displayName: 'Sort',
		name: 'sort',
		type: 'collection',
		placeholder: 'Add Sort Rule',
		default: {},
		displayOptions: showFor(resource, ['findDecayingContent']),
		options: [
			{
				displayName: 'Sort By',
				name: 'sortBy',
				type: 'options',
				options: [
					{
						name: 'Clicks Lost',
						value: 'clicksLost',
						description: 'Largest absolute loss first',
					},
					{
						name: 'Click Change Percentage',
						value: 'clickChangePct',
						description: 'Steepest relative drop first',
					},
				],
				default: 'clicksLost',
			},
		],
	},

	optionsCollection(
		resource,
		['findCannibalization', 'scoreOpportunities'],
		[endDateOption, fullResponseOption, minImpressionsOption, searchTypeOption, startDateOption],
	),
];
