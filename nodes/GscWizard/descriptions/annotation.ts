import type { INodeProperties } from 'n8n-workflow';
import {
	endDateOption,
	limitField,
	optionsCollection,
	propertyField,
	returnAllField,
	showFor,
	startDateOption,
} from './shared';

const resource = 'annotation';

const descriptionField: INodeProperties = {
	displayName: 'Description',
	name: 'description',
	type: 'string',
	typeOptions: { rows: 3 },
	default: '',
	description: 'Longer note shown with the annotation (up to 1,000 characters)',
};

const categoryField: INodeProperties = {
	displayName: 'Category',
	name: 'category',
	type: 'string',
	default: '',
	placeholder: 'e.g. release',
	description: 'Free-text category used to group annotations (up to 50 characters)',
};

const colorField: INodeProperties = {
	displayName: 'Color',
	name: 'color',
	type: 'color',
	default: '#6366f1',
	description: 'Marker color on the GSC Wizard chart',
};

export const annotationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Add a dated note to the GSC Wizard performance chart',
				action: 'Create annotation',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Permanently remove an annotation',
				action: 'Delete annotation',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description:
					'Retrieve the annotations of the account or a property, including Google ranking updates',
				action: 'Get many annotations',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change the date, label, description, category or color of an annotation',
				action: 'Update annotation',
			},
		],
		default: 'create',
	},
];

export const annotationFields: INodeProperties[] = [
	{
		displayName: 'Scope',
		name: 'scope',
		type: 'options',
		required: true,
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'Shown on the chart of every property',
			},
			{
				name: 'Property',
				value: 'property',
				description: 'Shown on the chart of one property only',
			},
		],
		default: 'property',
		description: 'Where the annotation applies',
		displayOptions: showFor(resource, ['create', 'getAll']),
	},
	propertyField(resource, ['create', 'getAll'], { scope: ['property'] }),
	{
		displayName: 'Date',
		name: 'eventDate',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'The day the event happened',
		displayOptions: showFor(resource, ['create']),
	},
	{
		displayName: 'Label',
		name: 'label',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. New pricing page live',
		description: 'Short title shown on the chart (up to 200 characters)',
		displayOptions: showFor(resource, ['create']),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(resource, ['create']),
		options: [categoryField, colorField, descriptionField],
	},
	{
		displayName: 'Annotation ID',
		name: 'annotationId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 3f2b6c1e-8d4a-4f7b-9c2e-1a5d6e7f8a9b',
		description: 'ID of the annotation, as returned by the Create or Get Many operation',
		displayOptions: showFor(resource, ['delete', 'update']),
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(resource, ['update']),
		options: [
			categoryField,
			colorField,
			{
				displayName: 'Date',
				name: 'eventDate',
				type: 'dateTime',
				default: '',
				description: 'The day the event happened',
			},
			descriptionField,
			{
				displayName: 'Label',
				name: 'label',
				type: 'string',
				default: '',
				description: 'Short title shown on the chart (up to 200 characters)',
			},
		],
	},
	returnAllField(resource, ['getAll']),
	limitField(resource, ['getAll'], 1000),
	optionsCollection(resource, ['getAll'], [endDateOption, startDateOption]),
];
