import { test, expect } from '@playwright/test';
import { installApiMocks } from './api-mocks';

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test('runs list and run detail', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
  await expect(page.getByText('smoke-agent')).toBeVisible();
  await page.getByRole('link', { name: /smoke-agent/ }).click();
  await expect(page.getByRole('heading', { name: 'smoke-agent', level: 1 })).toBeVisible();
  await expect(page.getByText('Execution tree')).toBeVisible();
});

test('shell navigation and compare flow', async ({ page }) => {
  await page.goto('/compare');
  await expect(page.getByRole('heading', { name: 'Compare versions' })).toBeVisible();
  await page.getByLabel('Input hash (sha256)').fill('b'.repeat(64));
  await page.getByRole('button', { name: 'Run comparison' }).click();
  await expect(page.getByText('spans[1].capture')).toBeVisible();
  await page.getByRole('link', { name: 'Runs' }).click();
  await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
});
