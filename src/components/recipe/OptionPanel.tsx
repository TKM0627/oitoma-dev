import type { RecipeDefinition } from '../../domain/content/schema';
import type { OptionValues } from '../../domain/recipe/generators';

export function OptionPanel({ recipe, values, onChange }: { recipe: RecipeDefinition; values: OptionValues; onChange: (values: OptionValues) => void }) {
  return <fieldset className="option-panel"><legend>選択肢を変えてみる</legend>{recipe.options.map((option) => <div className="option-field" key={option.key}>
    {option.type === 'boolean' ? <label className="checkbox-label"><input type="checkbox" checked={values[option.key] === true} onChange={(e) => onChange({ ...values, [option.key]: e.target.checked })} />{option.label}</label> : <><label htmlFor={`option-${option.key}`}>{option.label}</label><select id={`option-${option.key}`} value={String(values[option.key])} onChange={(e) => onChange({ ...values, [option.key]: option.type === 'integer' ? Number(e.target.value) : e.target.value })}>{option.type === 'select' ? option.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>) : Array.from({ length: option.max - option.min + 1 }, (_, i) => option.min + i).map((value) => <option key={value}>{value}</option>)}</select></>}
  </div>)}</fieldset>;
}
