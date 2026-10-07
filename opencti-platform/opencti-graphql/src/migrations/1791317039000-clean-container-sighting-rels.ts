import { logMigration } from '../config/conf';
import { elUpdateByQueryForMigration } from '../database/engine';
import { READ_INDEX_STIX_DOMAIN_OBJECTS } from '../database/utils';
import { buildRefRelationKey, ENTITY_TYPE_CONTAINER, ID_INFERRED, ID_INTERNAL } from '../schema/general';
import { STIX_SIGHTING_RELATIONSHIP } from '../schema/stixSightingRelationship';

const message = '[MIGRATION] Cleaning denormalized sightings rels on containers';

export const up = async (next: () => void) => {
  logMigration.info(`${message} > started`);
  // Sightings are no longer denormalized on the container side (see isSpecialNonImpactedCases)
  // Remove the existing ids so large containers shrink and no stale ids remain after sighting deletions
  // Denormalized refs are stored as flat dotted keys (rel_<type>.internal_id / rel_<type>.inferred_id)
  const fieldsToRemove = [buildRefRelationKey(STIX_SIGHTING_RELATIONSHIP, ID_INTERNAL), buildRefRelationKey(STIX_SIGHTING_RELATIONSHIP, ID_INFERRED)];
  const updateQuery = {
    script: {
      params: { fieldsToRemove },
      source: 'for (field in params.fieldsToRemove) { ctx._source.remove(field) }',
    },
    query: {
      bool: {
        must: [
          { term: { 'parent_types.keyword': { value: ENTITY_TYPE_CONTAINER } } },
        ],
        should: fieldsToRemove.map((field) => ({ exists: { field } })),
        minimum_should_match: 1,
      },
    },
  };
  await elUpdateByQueryForMigration(message, READ_INDEX_STIX_DOMAIN_OBJECTS, updateQuery);
  logMigration.info(`${message} > done`);
  next();
};

export const down = async (next: () => void) => {
  next();
};
