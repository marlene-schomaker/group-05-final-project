import * as initialSchema from './001_initial_schema.js';
import * as huddleSchema from './002_huddle_schema.js';

export const migrations = {
  '001_initial_schema': initialSchema,
  '002_huddle_schema': huddleSchema,
};
