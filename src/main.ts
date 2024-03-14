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
      ARTIFACT_URL
    } = getWorkflowInput()

    if (!INSTAWP_ACTIONS.includes(INSTAWP_ACTION)) {
      core.setFailed(
        `Invalid action: ${INSTAWP_ACTION}. Must be one of: ${INSTAWP_ACTIONS.join(', ')}`
      )
    }

    const octokit = getOctokit(GITHUB_TOKEN)
    const pullRequestsNo = context.payload.pull_request?.number ?? 0
    const repo = context.repo

    if (INSTAWP_ACTION === 'create-site-template-git') {
      core.info(`Creating site template with slug: ${INSTAWP_TEMPLATE_SLUG}`)

      const config = {
        template_slug: INSTAWP_TEMPLATE_SLUG,
        site_name: context.repo.repo,
        pr_num: pullRequestsNo,
        repo_id: REPO_ID,
        override_url: ARTIFACT_URL ?? undefined
      } satisfies CreateSiteTemplateGitInput

      try {
        const response = await createSiteGit(config, {
          token: INSTAWP_TOKEN
        })

        if (!response?.data) {
          const msg = response?.message ?? 'No data returned from InstaWP API'
          core.setFailed(`Failed to create site template: ${msg}`)
        }

        core.info(`Site template created at: ${response.data.wp_url}`)

        const taskId = response.data.task_id

        let taskInProgress = true
        while (taskInProgress) {
          const taskStatus = await getTaskStatus(taskId, {
            token: INSTAWP_TOKEN
          })

          if (taskStatus.data.status !== 'progress') {
            core.info(`Site created at: ${response.data.wp_url}`)
            break
          }

          taskInProgress = true

          core.info(`Waiting for site creation...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        const wpUrl = response.data.wp_url
        const wpMagicLoginLink = getMagicLink(response.data.s_hash)

        core.setOutput('instawp_url', wpUrl)
        core.setOutput('instawp_magic_login_url', wpMagicLoginLink)

        if (pullRequestsNo > 0) {
          const comments = await octokit.rest.issues.listComments({
            ...repo,
            issue_number: pullRequestsNo,
            per_page: 100
          })

          const comment = comments.data.find(c =>
            c?.body?.includes('<!-- INSTAWP-COMMENT -->')
          )

          if (undefined === comment) {
            await octokit.rest.issues.createComment({
              ...repo,
              issue_number: pullRequestsNo,
              body: `<!-- INSTAWP-COMMENT -->\nWordPress Instance Deployed.\n\nURL: [${wpUrl}](${wpUrl})\nMagic Login: [${wpMagicLoginLink}](${wpMagicLoginLink})`
            })
          } else {
            await octokit.rest.issues.updateComment({
              ...repo,
              issue_number: pullRequestsNo,
              comment_id: comment.id,
              body: `<!-- INSTAWP-COMMENT -->\nWordPress Instance Deployed.\n\nURL: [${wpUrl}](${wpUrl})\nMagic Login: [${wpMagicLoginLink}](${wpMagicLoginLink})`
            })
          }
        }
      } catch (error) {
        const err = error as Error
        core.setFailed(err.message)
      }
    } else [core.setFailed(`${INSTAWP_ACTION} has not been implemented yet.`)]
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
