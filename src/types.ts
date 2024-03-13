import { INSTAWP_ACTIONS } from './constants'

export type Maybe<T> = T | undefined | null
export type InstaWPAction = (typeof INSTAWP_ACTIONS)[number]

export type ApiOptions = {
  token: string
}

export type CreateSiteTemplateGitInput = {
  template_slug: string
  site_name: string
  pr_num: number
  repo_id: string
  override_url?: string
}

export type CreateSiteTemplateGitResponse = {
  status: boolean
  message: string
  data: {
    message: string
    task_id: string
    status: number
    wp_url: string
    wp_username: string
    wp_password: string
    id: number
    s_hash: string
    token: string | null
  }
}

export type TaskStatusResponse = {
  status: boolean
  message: string
  data: {
    id: number
    team_id: number
    user_id: number
    type: string
    comment: string | null
    cloud_task_id: string
    resource_id: number
    resource_type: string
    success_callback_fun: string
    error_callback_fun: string
    percentage_complete: string
    status: 'progress'
    timeout_at: string
    task_meta: string | null
    created_at: string
    updated_at: string
  }
}
