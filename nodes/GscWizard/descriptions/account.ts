import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description:
					'Retrieve the GSC Wizard account, its connected Google accounts and its subscription',
				action: 'Get account',
			},
		],
		default: 'get',
	},
];
