import * as initialSchema from './001_initial_schema.js';
import * as huddleSchema from './002_huddle_schema.js';
import * as weeklyAvailability from './003_weekly_availability.js';

export const migrations = {
  '001_initial_schema': initialSchema,
  '002_huddle_schema': huddleSchema,
  '003_weekly_availability': weeklyAvailability,
};
