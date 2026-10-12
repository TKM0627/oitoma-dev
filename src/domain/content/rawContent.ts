import topics from '../../data/topics.json' with { type: 'json' };
import recipes from '../../data/recipes.json' with { type: 'json' };
import errorCases from '../../data/error_cases.json' with { type: 'json' };
import references from '../../data/references.json' with { type: 'json' };
import tags from '../../data/tags.json' with { type: 'json' };
import explanations from '../../data/reviewed_explanations.json' with { type: 'json' };
import starterProfiles from '../../data/starter_profiles.json' with { type: 'json' };
import learningPaths from '../../data/learning_paths.json' with { type: 'json' };

export const rawContent = { topics, recipes, errorCases, references, tags, explanations, starterProfiles, learningPaths };
