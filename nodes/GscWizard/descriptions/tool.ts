import type { INodeProperties } from 'n8n-workflow';
import { fullResponseOption, optionsCollection, showFor } from './shared';

const resource = 'tool';

export const toolOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: [
			{
				name: 'Run',
				value: 'run',
				description:
					'Run any GSC Wizard tool, including Bing, Yandex, Merchant Center and Core Web Vitals reports',
				action: 'Run tool',
			},
		],
		default: 'run',
	},
];

export const toolFields: INodeProperties[] = [
	{
		displayName: 'Tool',
		name: 'toolName',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The GSC Wizard tool to run',
		displayOptions: showFor(resource, ['run']),
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchTools', searchable: true },
			},
			{
				displayName: 'By Name',
				name: 'name',
				type: 'string',
				placeholder: 'e.g. get_core_web_vitals',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[a-z0-9_-]+$',
							errorMessage: 'Enter a tool name such as get_core_web_vitals',
						},
					},
				],
			},
		],
	},
	{
		displayName: 'Arguments (JSON)',
		name: 'arguments',
		type: 'json',
		required: true,
		default: '{\n  "siteUrl": "sc-domain:example.com"\n}',
		description:
			"The tool's input as a JSON object. The README links the reference that lists the fields of every tool. Use {} for a tool without input.",
		displayOptions: showFor(resource, ['run']),
	},
	optionsCollection(
		resource,
		['run'],
		[
			{
				...fullResponseOption,
				description:
					'Whether to return the whole response as one item instead of one item per row, for tools that return a list',
			},
		],
	),
];
