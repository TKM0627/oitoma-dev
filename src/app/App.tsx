import { lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { StudyProvider } from './StudyProvider';
import { SearchProvider } from './SearchProvider';
import { SearchPage } from '../pages/SearchPage';
import { NotFoundPage } from '../pages/NotFoundPage';

const RecipePage = lazy(() => import('../pages/RecipePage').then((module) => ({ default: module.RecipePage })));
const TopicPage = lazy(() => import('../pages/TopicPage').then((module) => ({ default: module.TopicPage })));
const RecipeCatalogPage = lazy(() => import('../pages/RecipeCatalogPage').then((module) => ({ default: module.RecipeCatalogPage })));
const DiagnosePage = lazy(() => import('../pages/DiagnosePage').then((module) => ({ default: module.DiagnosePage })));
const ErrorCasePage = lazy(() => import('../pages/ErrorCasePage').then((module) => ({ default: module.ErrorCasePage })));
const HelpPage = lazy(() => import('../pages/HelpPage').then((module) => ({ default: module.HelpPage })));
const JapanesePage = lazy(() => import('../pages/JapanesePage').then((module) => ({ default: module.JapanesePage })));
const LearnPage = lazy(() => import('../pages/LearnPage').then((module) => ({ default: module.LearnPage })));
const ReferencePage = lazy(() => import('../pages/ReferencePage').then((module) => ({ default: module.ReferencePage })));
const WorkspacePage = __DEV_LLM__ ? lazy(() => import('../components/workspace/LlmPanel')) : lazy(() => import('../pages/WorkspacePage').then((module) => ({ default: module.WorkspacePage })));

export function App() {
  return <StudyProvider><SearchProvider><HashRouter><Routes><Route element={<AppShell />}>
    <Route index element={<Navigate to="/search" replace />} />
    <Route path="search" element={<SearchPage />} />
    <Route path="topics/:id" element={<TopicPage />} />
    <Route path="recipes" element={<RecipeCatalogPage />} />
    <Route path="recipes/:id" element={<RecipePage />} />
    <Route path="diagnose" element={<DiagnosePage />} />
    <Route path="workspace" element={<WorkspacePage />} />
    <Route path="errors/:id" element={<ErrorCasePage />} />
    <Route path="help" element={<HelpPage />} />
    <Route path="japanese" element={<JapanesePage />} />
    <Route path="learn" element={<LearnPage />} />
    <Route path="reference" element={<ReferencePage />} />
    <Route path="reference/:id" element={<ReferencePage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes></HashRouter></SearchProvider></StudyProvider>;
}
