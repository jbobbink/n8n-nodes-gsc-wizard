import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const BASE_URL = 'https://mcp.gscwizard.com/v1';

/** Stop walking pages after this many requests, so a runaway "Return All" stays bounded. */
const MAX_PAGES = 100;

type Context = IExecuteFunctions | ILoadOptionsFunctions;

interface ApiErrorBody {
	code?: string;
	message?: string;
	nextStep?: string;
}

function parseBody(value: unknown): ApiErrorBody | undefined {
	let body = value;
	if (typeof body === 'string') {
		try {
			body = JSON.parse(body);
		} catch {
			return undefined;
		}
	}
	if (body && typeof body === 'object' && 'error' in body) {
		const inner = (body as { error: unknown }).error;
		if (inner && typeof inner === 'object') return inner as ApiErrorBody;
	}
	return undefined;
}

/** Find GSC Wizard's `{ error: { code, message, nextStep } }` body wherever the HTTP helper put it. */
function findApiError(error: unknown): { status?: number; body?: ApiErrorBody } {
	const e = error as IDataObject & {
		cause?: IDataObject & { response?: IDataObject };
		response?: IDataObject;
		context?: IDataObject;
	};
	const candidates = [
		e?.cause?.response?.data,
		e?.cause?.response?.body,
		e?.response?.data,
		e?.response?.body,
		e?.cause?.error,
		e?.error,
		e?.context?.data,
	];
	let body: ApiErrorBody | undefined;
	for (const candidate of candidates) {
		body = parseBody(candidate);
		if (body) break;
	}
	const rawStatus =
		e?.httpCode ?? e?.cause?.response?.status ?? e?.response?.status ?? e?.statusCode;
	const status = rawStatus === undefined || rawStatus === null ? undefined : Number(rawStatus);
	return { status: Number.isFinite(status) ? status : undefined, body };
}

function joinSentences(...parts: Array<string | undefined>): string | undefined {
	const text = parts
		.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
		.map((p) => p.trim())
		.map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
		.join(' ');
	return text.length > 0 ? text : undefined;
}

/** Turn an HTTP failure into a message that says what happened and a description that says what to do. */
export function toNodeApiError(context: Context, error: unknown, itemIndex?: number): NodeApiError {
	const { status, body } = findApiError(error);
	const apiMessage = body?.message;
	const suffix = itemIndex === undefined ? '' : ` [Item ${itemIndex}]`;
	let message: string;
	let description: string | undefined;

	switch (status) {
		case 400:
			message = `GSC Wizard did not accept the request${suffix}`;
			description = joinSentences(
				apiMessage,
				body?.nextStep ?? 'Check the values entered in the node and run it again.',
			);
			break;
		case 401:
			message = `GSC Wizard did not accept the credential${suffix}`;
			description = joinSentences(
				apiMessage,
				'Open the GSC Wizard credential and paste a valid API key (GSC Wizard app > Account > MCP API keys).',
			);
			break;
		case 402:
			message = `The GSC Wizard account has no active plan${suffix}`;
			description = joinSentences(
				apiMessage,
				'Start or renew a plan at https://tool.gscwizard.com/settings/subscription, then run the node again.',
			);
			break;
		case 403:
			message = `GSC Wizard refused access${suffix}`;
			description = joinSentences(
				apiMessage,
				body?.nextStep ??
					'Check that the property is connected and activated in GSC Wizard, and that the API key is not read-only for write operations.',
			);
			break;
		case 404:
			message = `GSC Wizard could not find what was requested${suffix}`;
			description = joinSentences(
				apiMessage,
				body?.nextStep ?? 'Check the property, ID or tool name selected in the node.',
			);
			break;
		case 429:
			message = `GSC Wizard rate limit reached${suffix}`;
			description = joinSentences(
				apiMessage,
				"Wait a minute and run the node again, or turn on 'Retry On Fail' in the node settings.",
			);
			break;
		default:
			message = `GSC Wizard could not complete the request${suffix}`;
			description = joinSentences(
				apiMessage,
				body?.nextStep,
				'Run the node again in a few minutes. If it keeps happening, contact support@gscwizard.com.',
			);
	}

	const httpCode = status === undefined ? undefined : String(status);
	const apiError = new NodeApiError(context.getNode(), error as JsonObject, {
		message,
		description,
		httpCode,
		itemIndex,
	});
	// NodeApiError prefers the raw response body over the description passed in,
	// and hands back an error the HTTP helper already wrapped unchanged, so the
	// text is set again here.
	apiError.message = message;
	apiError.description = description;
	if (httpCode) apiError.httpCode = httpCode;
	if (itemIndex !== undefined) apiError.context.itemIndex = itemIndex;
	return apiError;
}

export async function gscWizardApiRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	itemIndex = 0,
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `${BASE_URL}${path}`,
		headers: { Accept: 'application/json' },
		json: true,
	};
	if (body !== undefined) options.body = body;

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'gscWizardApi',
			options,
		)) as IDataObject;
	} catch (error) {
		throw toNodeApiError(this, error, 'getInputData' in this ? itemIndex : undefined);
	}
}

export async function runTool(
	this: Context,
	tool: string,
	args: IDataObject,
	itemIndex = 0,
): Promise<IDataObject> {
	return await gscWizardApiRequest.call(
		this,
		'POST',
		`/tools/${encodeURIComponent(tool)}`,
		args,
		itemIndex,
	);
}

export interface Paging {
	limitKey: string;
	offsetKey: string;
	pageSize: number;
}

/**
 * Walk a paged tool (`pagination.hasMore` / `pagination.nextOffset`) until the
 * limit is reached, the tool says there is nothing more, or MAX_PAGES requests.
 */
export async function runToolPaged(
	this: IExecuteFunctions,
	tool: string,
	args: IDataObject,
	listKey: string,
	paging: Paging,
	returnAll: boolean,
	limit: number,
	itemIndex: number,
): Promise<IDataObject[]> {
	const rows: IDataObject[] = [];
	let offset = 0;
	for (let page = 0; page < MAX_PAGES; page++) {
		const wanted = returnAll ? paging.pageSize : Math.min(paging.pageSize, limit - rows.length);
		const response = await runTool.call(
			this,
			tool,
			{ ...args, [paging.limitKey]: wanted, [paging.offsetKey]: offset },
			itemIndex,
		);
		const pageRows = Array.isArray(response[listKey]) ? (response[listKey] as IDataObject[]) : [];
		rows.push(...pageRows);
		if (!returnAll && rows.length >= limit) break;
		const pagination = response.pagination as IDataObject | undefined;
		if (!pagination?.hasMore || pageRows.length === 0) break;
		const next = Number(pagination.nextOffset);
		offset = Number.isFinite(next) && next > offset ? next : offset + pageRows.length;
	}
	return returnAll ? rows : rows.slice(0, limit);
}
