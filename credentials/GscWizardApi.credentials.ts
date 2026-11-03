import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class GscWizardApi implements ICredentialType {
	name = 'gscWizardApi';

	displayName = 'GSC Wizard API';

	icon: Icon = { light: 'file:../icons/gscWizard.svg', dark: 'file:../icons/gscWizard.dark.svg' };

	documentationUrl = 'https://github.com/jbobbink/n8n-nodes-gsc-wizard?tab=readme-ov-file#api-key';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'e.g. gscw_live_...',
			description:
				'Create a key in the GSC Wizard app under Account > MCP API keys. A read-only key cannot run the write operations (annotations, sitemaps, IndexNow).',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://mcp.gscwizard.com/v1',
			url: '/account',
			method: 'GET',
		},
	};
}
