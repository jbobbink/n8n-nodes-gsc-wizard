import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * OAuth2 with PKCE against GSC Wizard's authorization server.
 *
 * n8n registers its own client (RFC 7591) from the API's protected-resource
 * metadata, so the user only clicks "Connect" and approves access in GSC
 * Wizard. The fixed endpoints below are the fallback for n8n versions without
 * dynamic client registration, where the credential asks for a Client ID and
 * Client Secret instead (see the README for registering one by hand).
 */
export class GscWizardOAuth2Api implements ICredentialType {
	name = 'gscWizardOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'GSC Wizard OAuth2 API';

	icon: Icon = { light: 'file:../icons/gscWizard.svg', dark: 'file:../icons/gscWizard.dark.svg' };

	documentationUrl = 'https://github.com/jbobbink/n8n-nodes-gsc-wizard?tab=readme-ov-file#oauth2';

	properties: INodeProperties[] = [
		{
			displayName: 'Use Dynamic Client Registration',
			name: 'useDynamicClientRegistration',
			type: 'hidden',
			default: true,
		},
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'hidden',
			default: 'https://mcp.gscwizard.com/v1',
		},
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'pkce',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://tool.gscwizard.com/oauth/authorize',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://tool.gscwizard.com/api/oauth/token',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: 'mcp:read mcp:write',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'header',
		},
	];
}
