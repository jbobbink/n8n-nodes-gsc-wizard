import type { INodeProperties } from 'n8n-workflow';
import {
	limitField,
	optionsCollection,
	propertyField,
	returnAllField,
	showFor,
	simplifyField,
} from './shared';

const resource = 'urlInspection';

export const urlInspectionOperations: INodeProperties[] = [
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
				description: 'Retrieve stored results of earlier URL inspections, newest first',
				action: 'Get many URL inspections',
			},
			{
				name: 'Get Quota',
				value: 'getQuota',
				description: 'Retrieve how many URL inspections the property has left today',
				action: 'Get URL inspection quota',
			},
			{
				name: 'Inspect',
				value: 'inspect',
				description:
					'Ask Google for the index status of a URL: verdict, coverage, last crawl and canonical',
				action: 'Inspect URL',
			},
		],
		default: 'inspect',
	},
];

export const urlInspectionFields: INodeProperties[] = [
	propertyField(resource, ['inspect', 'getAll', 'getQuota']),
	{
		displayName: 'URL',
		name: 'inspectionUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://www.example.com/pricing',
		description: 'Full URL to inspect. It must belong to the property.',
		displayOptions: showFor(resource, ['inspect']),
	},
	returnAllField(resource, ['getAll']),
	limitField(resource, ['getAll'], 10000),
	simplifyField(resource, ['inspect', 'getAll']),
	optionsCollection(
		resource,
		['getAll'],
		[
			{
				displayName: 'Latest per URL',
				name: 'latestPerUrl',
				type: 'boolean',
				default: false,
				description: 'Whether to keep only the most recent inspection of each URL',
			},
			{
				displayName: 'URL Contains',
				name: 'urlContains',
				type: 'string',
				default: '',
				placeholder: 'e.g. /blog/',
				description: 'Only return inspections of URLs that contain this text',
			},
		],
	),
];
