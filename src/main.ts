import * as core from '@actions/core'
import { getOctokit, context } from '@actions/github'
import { INSTAWP_ACTIONS } from './constants'
import type { CreateSiteTemplateGitInput } from './types'
import {
  createSiteGit,
  getWorkflowInput,
  getTaskStatus,
  getMagicLink
} from './utils'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const {
      GITHUB_TOKEN,
      INSTAWP_TOKEN,
      INSTAWP_ACTION,
      INSTAWP_TEMPLATE_SLUG,
      REPO_ID,
      ARTIFACT_URL,
      TIMEOUT_SECONDS
    } = getWorkflowInput()

    if (!INSTAWP_ACTIONS.includes(INSTAWP_ACTION)) {
      core.setFailed(
        `Invalid action: ${INSTAWP_ACTION}. Must be one of: ${INSTAWP_ACTIONS.join(', ')}`
      )
      return
    }

    const octokit = getOctokit(GITHUB_TOKEN)
    const pullRequestsNo = context.payload.pull_request?.number ?? 0
    const repo = context.repo

    if (INSTAWP_ACTION === 'create-site-template-git') {
      core.info(`Creating site template with slug: ${INSTAWP_TEMPLATE_SLUG}`)

      if (ARTIFACT_URL) {
        core.info(`Using artifact URL: ${ARTIFACT_URL}`)
      }

      const config = {
        template_slug: INSTAWP_TEMPLATE_SLUG,
        site_name: `${repo.owner}-${repo.repo}-${context.sha}`,
        pr_num: pullRequestsNo,
        repo_id: REPO_ID,
        override_url: ARTIFACT_URL ?? undefined
      } satisfies CreateSiteTemplateGitInput

      core.info(`Creating site template with config: ${JSON.stringify(config)}`)

      const response = await createSiteGit(config, { token: INSTAWP_TOKEN })

      if (!response?.data) {
        core.setFailed(
          `Failed to create site template: ${response?.message ?? 'No data returned from InstaWP API'}`
        )
        return
      }

      if (!response.data.wp_url) {
        core.setFailed(
          `Failed to create site template (wp_url is not defined): ${response.data.message ?? 'No data returned from InstaWP API'}`
        )
        return
      }

      if (!response.data.s_hash) {
        core.setFailed(
          `Failed to create site template (s_hash is not defined): ${response.data.message ?? 'No data returned from InstaWP API'}`
        )
        return
      }

      core.info(`Site template created at: ${response.data.wp_url}`)
      const taskId = response.data.task_id

      const timeout = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error('Task timeout reached, InstaWP API did not respond')
            ),
          TIMEOUT_SECONDS * 1000
        )
      )

      try {
        await Promise.race([
          (async function checkStatus() {
            let status = 'progress'
            while (status === 'progress') {
              const taskStatus = await getTaskStatus(taskId, {
                token: INSTAWP_TOKEN
              })
              status = taskStatus.data.status
              if (status !== 'progress') {
                core.info(`Site created at: ${response.data.wp_url}`)
                break
              }
              core.info('Waiting for site creation...')
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          })(),
          timeout
        ])
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Task timeout reached'

        core.setFailed(message)
        return
      }

      const wpUrl = response.data.wp_url
      const wpMagicLoginLink = getMagicLink(response.data.s_hash)

      core.setOutput('instawp_url', wpUrl)
      core.setOutput('instawp_magic_login_url', wpMagicLoginLink)

      await updateOrCreateComment({
        octokit,
        repo,
        pullRequestsNo,
        wpUrl,
        wpMagicLoginLink
      })
    } else {
      core.setFailed(`${INSTAWP_ACTION} has not been implemented yet.`)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function updateOrCreateComment({
  octokit,
  repo,
  pullRequestsNo,
  wpUrl,
  wpMagicLoginLink
}: {
  octokit: ReturnType<typeof getOctokit>
  repo: { owner: string; repo: string }
  pullRequestsNo: number
  wpUrl: string
  wpMagicLoginLink: string
}) {
  if (pullRequestsNo > 0) {
    const comments = await octokit.rest.issues.listComments({
      ...repo,
      issue_number: pullRequestsNo,
      per_page: 100
    })
    const comment = comments.data.find(c =>
      c?.body?.includes('<!-- INSTAWP-COMMENT -->')
    )
    const body = `<!-- INSTAWP-COMMENT -->\nWordPress Instance Deployed.\n\nURL: [${wpUrl}](${wpUrl})\nMagic Login: [${wpMagicLoginLink}](${wpMagicLoginLink})`
    if (undefined === comment) {
      await octokit.rest.issues.createComment({
        ...repo,
        issue_number: pullRequestsNo,
        body
      })
    } else {
      await octokit.rest.issues.updateComment({
        ...repo,
        issue_number: pullRequestsNo,
        comment_id: comment.id,
        body
      })
    }
  }
}
