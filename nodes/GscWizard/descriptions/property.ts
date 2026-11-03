import type { INodeProperties } from 'n8n-workflow';
import {
	brandOption,
	endDateOption,
	limitField,
	optionsCollection,
	propertyField,
	returnAllField,
	searchTypeOption,
	simplifyField,
	startDateOption,
} from './shared';

const resource = 'property';

export const propertyOperations: INodeProperties[] = [
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
				description: 'List the Search Console properties connected to GSC Wizard',
				action: 'Get many properties',
			},
			{
				name: 'Get Performance Summary',
				value: 'getSummary',
				description:
					'Retrieve clicks, impressions, CTR and average position of a property, compared with the previous period',
				action: 'Get property performance summary',
			},
		],
		default: 'getAll',
	},
];

export const propertyFields: INodeProperties[] = [
	returnAllField(resource, ['getAll']),
	limitField(resource, ['getAll'], 1000),
	simplifyField(resource, ['getAll']),
	propertyField(resource, ['getSummary']),
	optionsCollection(
		resource,
		['getSummary'],
		[
			brandOption,
			{
				displayName: 'Days',
				name: 'days',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 180 },
				default: 28,
				description:
					'Length of the trailing window in days. Ignored for any edge set with a start or end date.',
			},
			endDateOption,
			searchTypeOption,
			startDateOption,
		],
	),
];
