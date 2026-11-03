import type { INodeProperties } from 'n8n-workflow';
import { limitField, propertyField, returnAllField, showFor } from './shared';

const resource = 'sitemap';

export const sitemapOperations: INodeProperties[] = [
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
				description:
					'List the sitemaps submitted to Search Console for a property, with warnings and errors',
				action: 'Get many sitemaps',
			},
			{
				name: 'Submit',
				value: 'submit',
				description: 'Submit one or more published sitemaps to Google Search Console',
				action: 'Submit sitemap',
			},
		],
		default: 'getAll',
	},
];

export const sitemapFields: INodeProperties[] = [
	propertyField(resource, ['getAll', 'submit']),
	{
		displayName: 'Sitemap URLs',
		name: 'sitemapUrls',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://www.example.com/sitemap.xml',
		description:
			'Full URL of a published sitemap. Separate several (up to 20) with commas or new lines.',
		displayOptions: showFor(resource, ['submit']),
	},
	returnAllField(resource, ['getAll']),
	limitField(resource, ['getAll'], 1000),
];
