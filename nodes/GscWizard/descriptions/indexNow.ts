import type { INodeProperties } from 'n8n-workflow';
import { limitField, propertyField, showFor } from './shared';

const resource = 'indexNow';

export const indexNowOperations: INodeProperties[] = [
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
				description: 'Retrieve the URLs sent to IndexNow for a property, newest first',
				action: 'Get many submissions',
			},
			{
				name: 'Submit URLs',
				value: 'submit',
				description:
					'Notify Bing, Yandex and other IndexNow search engines that pages were added or changed',
				action: 'Submit URL',
			},
		],
		default: 'submit',
	},
];

export const indexNowFields: INodeProperties[] = [
	propertyField(resource, ['submit', 'getAll']),
	{
		displayName: 'URLs',
		name: 'urls',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://www.example.com/new-page',
		description:
			'Full URLs on the property. Separate several (up to 100) with commas or new lines.',
		displayOptions: showFor(resource, ['submit']),
	},
	limitField(resource, ['getAll'], 500, false),
];
