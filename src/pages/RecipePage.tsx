import { SearchReturnLink } from '../components/search/SearchReturnLink';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { findRecipe } from '../domain/content/contentRepository';
import type { RecipeDefinition } from '../domain/content/schema';
import { defaultOptions, generateRecipe } from '../domain/recipe/recipeEngine';
import { CodeBlock } from '../components/common/CodeBlock';
import { PackageNotice, PageHeading } from '../components/common/ContentParts';
import { FormulaPreview } from '../components/recipe/FormulaPreview';
import { OptionPanel } from '../components/recipe/OptionPanel';
import { SymbolCatalogDisclosure } from '../components/symbols/SymbolCatalogDisclosure';
import { NotFoundPage } from './NotFoundPage';

function RecipeEditor({ recipe }: { recipe: RecipeDefinition }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(() => defaultOptions(recipe));
  const result = generateRecipe(recipe, values);
  return <><PageHeading title={recipe.title} description={recipe.description} /><div className="recipe-workspace"><div><OptionPanel recipe={recipe} values={values} onChange={setValues} /><button className="text-button" onClick={() => setValues(defaultOptions(recipe))}>選択肢を初期値に戻す</button><PackageNotice packages={result.requiredPackages} /><Link className="text-button" to={`/topics/${recipe.topicId}`}>この構文の解説を読む →</Link></div><div><FormulaPreview formula={result.formula} displayMode={result.displayMode} mode={result.previewMode} /><CodeBlock code={result.code} label="生成したLaTeX" /><p className="small muted">{result.displayMode ? '\\[ … \\]を含む、本文に置けるコードです。' : '$ … $を含む、文中に置けるコードです。'} 既に数式モードの場所では、外側の区切りを外してください。</p></div></div>{recipe.id === 'symbols' && <SymbolCatalogDisclosure />}<aside className="next-step"><div><h2>この式を、診断でも確認。</h2><p>選んだレシピからコードを再生成して、診断画面へ渡します。</p></div><button className="button secondary" onClick={() => void navigate('/diagnose', { state: { recipeId: recipe.id, options: values } })}>生成コードを診断する →</button></aside></>;
}
export function RecipePage() {
  const { id } = useParams();
  const recipe = findRecipe(id || '');
  return <div className="page"><SearchReturnLink fallbackTo="/recipes" fallbackLabel="← レシピ一覧に戻る" />{recipe ? <RecipeEditor key={recipe.id} recipe={recipe} /> : <NotFoundPage />}</div>;
}
