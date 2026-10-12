import { Link } from 'react-router-dom';
import { content } from '../domain/content/contentRepository';
import { PageHeading } from '../components/common/ContentParts';

export function RecipeCatalogPage() {
  return <div className="page"><PageHeading title="数式レシピ" description="選択肢を変えて、LaTeXコードと数式プレビューを確認できます。" /><div className="recipe-grid">{content.recipes.map((recipe) => <article className="recipe-card" key={recipe.id}><h2><Link to={`/recipes/${recipe.id}`}>{recipe.title}</Link></h2><p>{recipe.description}</p><Link className="text-button" to={`/recipes/${recipe.id}`} aria-label={`${recipe.title}を試す`}>試す →</Link></article>)}</div><div className="notice">生成するのは選択肢から決まる数式です。自由入力の文書全体をコンパイルする機能はありません。</div></div>;
}
