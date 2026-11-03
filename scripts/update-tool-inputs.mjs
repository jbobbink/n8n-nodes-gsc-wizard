// Refreshes test/fixtures/tool-inputs.json from the live GSC Wizard OpenAPI
// spec: for every tool, the input fields it accepts and the ones it requires.
// The contract test checks every request the node builds against it, because
// the API rejects unknown fields. Run with `node scripts/update-tool-inputs.mjs`.
import { writeFileSync } from 'node:fs';

const response = await fetch('https://mcp.gscwizard.com/v1/openapi.json');
if (!response.ok) throw new Error(`OpenAPI spec answered ${response.status}`);
const spec = await response.json();

const tools = {};
for (const [path, item] of Object.entries(spec.paths)) {
	const match = /^\/tools\/([a-z0-9_]+)$/.exec(path);
	if (!match) continue;
	const schema = item.post?.requestBody?.content?.['application/json']?.schema ?? {};
	tools[match[1]] = {
		properties: Object.keys(schema.properties ?? {}).sort(),
		required: [...(schema.required ?? [])].sort(),
	};
}

const sorted = Object.fromEntries(Object.entries(tools).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
	new URL('../test/fixtures/tool-inputs.json', import.meta.url),
	`${JSON.stringify({ apiVersion: spec.info.version, tools: sorted }, null, '\t')}\n`,
);
console.log(`Wrote ${Object.keys(sorted).length} tools (API ${spec.info.version})`);
