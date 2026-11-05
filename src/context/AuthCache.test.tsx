import { useEffect } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { queryClient } from '../lib/queryClient'

const api = vi.hoisted(() => ({ login: vi.fn(), me: vi.fn() }))

vi.mock('../lib/api', () => ({
  apiGetMe: (...a: unknown[]) => api.me(...a),
  apiLogin: (...a: unknown[]) => api.login(...a),
  apiGoogleAuth: vi.fn(),
  apiLoginWithPhone: vi.fn(),
  apiRegister: vi.fn(),
  apiSignupWithPhone: vi.fn(),
}))

let auth: ReturnType<typeof useAuth>
function Probe() {
  const value = useAuth()
  useEffect(() => {
    auth = value
  })
  return null
}

const employer = (id: string) => ({ id, email: `${id}@example.com`, role: 'EMPLOYER', employerProfile: { companyName: id } })

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  queryClient.clear()
})

describe('dashboard data belongs to one person', () => {
  it('signing in as a different account drops the previous account\'s cached dashboard', async () => {
    // The first account looked at its dashboard: no jobs.
    queryClient.setQueryData(['employer', 'dashboard'], { jobs: [] })
    api.login.mockResolvedValue({ token: 'tok', user: employer('akoko') })
    api.me.mockResolvedValue({ user: employer('akoko') })
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(auth.isLoading).toBe(false))

    await act(async () => {
      await auth.login('hr@akoko.example', 'Passw0rd!xyz')
    })

    expect(queryClient.getQueryData(['employer', 'dashboard'])).toBeUndefined()
  })

  it('signing out drops it too', async () => {
    localStorage.setItem('jobwahala_token', 'tok')
    api.me.mockResolvedValue({ user: employer('akoko') })
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(auth.user?.id).toBe('akoko'))
    queryClient.setQueryData(['employer', 'dashboard'], { jobs: [{ id: 'job-1' }] })

    act(() => auth.logout())

    expect(queryClient.getQueryData(['employer', 'dashboard'])).toBeUndefined()
    expect(auth.user).toBeNull()
  })
})

describe('staying signed in', () => {
  const mount = () =>
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

  it('a refusal from the server (the saved token is no good) signs the person out', async () => {
    localStorage.setItem('jobwahala_token', 'old')
    api.me.mockRejectedValue(Object.assign(new Error('Token is not valid'), { status: 401 }))
    mount()

    await waitFor(() => expect(auth.isLoading).toBe(false))

    expect(auth.user).toBeNull()
    expect(localStorage.getItem('jobwahala_token')).toBeNull()
  })

  it('a network error or a server that is restarting does not: it tries again and keeps the token', async () => {
    localStorage.setItem('jobwahala_token', 'good')
    api.me.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({ user: employer('akoko') })
    mount()

    await waitFor(() => expect(auth.user?.id).toBe('akoko'), { timeout: 4000 })

    expect(api.me).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem('jobwahala_token')).toBe('good')
  })

  it('if the server stays down the token is still kept, so the next visit works', async () => {
    localStorage.setItem('jobwahala_token', 'good')
    api.me.mockRejectedValue(Object.assign(new Error('Bad gateway'), { status: 502 }))
    mount()

    await waitFor(() => expect(auth.isLoading).toBe(false), { timeout: 4000 })

    expect(localStorage.getItem('jobwahala_token')).toBe('good')
  })
})
