import { getInput } from '@actions/core'
import type {
  ApiOptions,
  CreateSiteTemplateGitInput,
  CreateSiteTemplateGitResponse,
  InstaWPAction,
  Maybe,
  TaskStatusResponse
} from './types'
import { INSTAWP_API_BASE } from './constants'

export const getMagicLink = (hash: string): string => {
  const url = new URL('https://app.instawp.io/wordpress-auto-login')
  url.searchParams.set('site', hash)

  return url.toString()
}

export const getWorkflowInput = (): {
  GITHUB_TOKEN: string
  INSTAWP_TOKEN: string
  INSTAWP_ACTION: InstaWPAction
  INSTAWP_TEMPLATE_SLUG: string
  ARTIFACT_URL: string | null
  REPO_ID: string
  TIMEOUT_SECONDS: number
} => {
  const GITHUB_TOKEN = getInput('github-token')
  const REPO_ID = getInput('repo-id')
  const INSTAWP_TOKEN = getInput('instawp-token')
  const INSTAWP_ACTION = getInput('instawp-action') as InstaWPAction
  const INSTAWP_TEMPLATE_SLUG = getInput('instawp-template-slug')
  const TIMEOUT_SECONDS = getInput('timeout-seconds', { required: false })

  const ARTIFACT_URL =
    (getInput('instawp-artifact-zip-url', {
      required: false
    }) as Maybe<string>) ?? null

  return {
    GITHUB_TOKEN,
    INSTAWP_TOKEN,
    INSTAWP_ACTION,
    INSTAWP_TEMPLATE_SLUG,
    ARTIFACT_URL,
    REPO_ID,
    TIMEOUT_SECONDS: TIMEOUT_SECONDS ? parseInt(TIMEOUT_SECONDS) : 120
  }
}

export const commonHeaders = (
  token: string
): {
  authorization: string
  'content-type': string
} => ({
  authorization: `Bearer ${token}`,
  'content-type': 'application/json'
})

export async function createSiteGit(
  config: CreateSiteTemplateGitInput,
  { token }: ApiOptions
): Promise<CreateSiteTemplateGitResponse> {
  const response = await fetch(`${INSTAWP_API_BASE}/sites/git`, {
    method: 'POST',
    headers: commonHeaders(token),
    body: JSON.stringify(config)
  })

  const responseText = await response.text() // Get the response body as text
  console.log('Debug Response Body:', responseText) // Log the body for debugging

  if (!response.ok) {
    throw new Error(
      `[createSiteGit] Failed to create site template: HTTP ${response.status} ${response.statusText}`
    )
  }

  try {
    return JSON.parse(responseText) // Parse the response body as JSON
  } catch (error) {
    const err = error as Error

    throw new Error(
      `[createSiteGit] Error parsing JSON from response: ${err.message}`
    )
  }
}

export async function getTaskStatus(
  taskId: string,
  { token }: ApiOptions
): Promise<TaskStatusResponse> {
  const response = await fetch(`${INSTAWP_API_BASE}/tasks/${taskId}/status`, {
    method: 'GET',
    headers: commonHeaders(token)
  })
  const responseText = await response.text() // Get the response body as text
  console.log('Debug Response Body:', responseText) // Log the body for debugging

  if (!response.ok) {
    throw new Error(
      `[getTaskStatus] Failed to create site template: HTTP ${response.status} ${response.statusText}`
    )
  }

  try {
    return JSON.parse(responseText) // Parse the response body as JSON
  } catch (error) {
    const err = error as Error
    throw new Error(
      `[getTaskStatus] Error parsing JSON from response: ${err.message}`
    )
  }
}
