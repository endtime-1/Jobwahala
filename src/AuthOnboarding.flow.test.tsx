import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './context/AuthContext'

type MockUser = {
  id: string
  email: string
  role: 'SEEKER'
  jobSeekerProfile?: {
    firstName?: string | null
    lastName?: string | null
    experience?: string | null
    skills?: string | null
    resumeFileUrl?: string | null
  } | null
}

vi.mock('./components/Layout', async () => {
  const router = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )

  return {
    default: function LayoutMock() {
      const Outlet = router.Outlet
      return (
        <div data-testid="layout">
          <Outlet />
        </div>
      )
    },
  }
})

vi.mock('./pages/Dashboard', () => ({
  default: () => <div>Dashboard Workspace</div>,
}))

function jsonResponse(data: unknown, status = 200) {
  const text = JSON.stringify(data)

  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => data,
  } as Response)
}

function getHeader(headers: HeadersInit | undefined, name: string) {
  if (!headers) return null

  if (headers instanceof Headers) {
    return headers.get(name)
  }

  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === name.toLowerCase())
    return match?.[1] ?? null
  }

  const value = (headers as Record<string, string>)[name]
  if (value) return value

  const lowerCaseName = Object.keys(headers).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  )

  return lowerCaseName ? (headers as Record<string, string>)[lowerCaseName] : null
}

describe('Auth onboarding flow', () => {
  let currentUser: MockUser
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()

    currentUser = {
      id: 'user-1',
      email: 'flow-seeker@example.com',
      role: 'SEEKER',
      jobSeekerProfile: null,
    }

    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/auth/register') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          email: string
          password: string
          role: string
        }

        currentUser = {
          ...currentUser,
          email: body.email,
        }

        return jsonResponse({
          success: true,
          token: 'test-flow-token',
          user: currentUser,
        })
      }

      if (url.endsWith('/auth/me')) {
        expect(getHeader(init?.headers, 'Authorization')).toBe('Bearer test-flow-token')

        return jsonResponse({
          success: true,
          user: currentUser,
        })
      }

      if (url.endsWith('/users/profile') && init?.method === 'PUT') {
        expect(getHeader(init?.headers, 'Authorization')).toBe('Bearer test-flow-token')

        const body = JSON.parse(String(init.body)) as {
          experience: string
          skills: string
        }

        currentUser = {
          ...currentUser,
          jobSeekerProfile: {
            experience: body.experience,
            skills: body.skills,
          },
        }

        return jsonResponse({
          success: true,
          profile: currentUser.jobSeekerProfile,
        })
      }

      throw new Error(`Unhandled fetch request: ${init?.method ?? 'GET'} ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('signs up a seeker, completes onboarding, and lands in the dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.queryByText('Loading Page')).not.toBeInTheDocument()
    }, { timeout: 5000 })

    fireEvent.change(await screen.findByPlaceholderText('Enter your full name'), {
      target: { value: 'Flow Test User' },
    })
    fireEvent.change(screen.getByPlaceholderText('name@enterprise.com'), {
      target: { value: 'flow-seeker@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Min 12 characters'), {
      target: { value: 'SuperSecure123!' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /initialize profile/i }),
    )

    expect(
      await screen.findByText('Complete your candidate profile'),
    ).toBeInTheDocument()
    expect(localStorage.getItem('jobwahala_token')).toBe('test-flow-token')

    fireEvent.change(
      screen.getByPlaceholderText(
        'Frontend engineer with 4 years building React products...',
      ),
      {
        target: {
          value: 'Frontend engineer building marketplace workflows.',
        },
      },
    )
    fireEvent.change(
      screen.getByPlaceholderText('React, TypeScript, Tailwind, Testing'),
      {
        target: { value: 'React, TypeScript, Testing' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: /access workspace/i }))

    expect(await screen.findByText('Dashboard Workspace')).toBeInTheDocument()

    await waitFor(() => {
      const meCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith('/auth/me'),
      )
      const profileCall = fetchMock.mock.calls.find(([input]) =>
        String(input).endsWith('/users/profile'),
      )

      expect(meCalls).toHaveLength(3)
      expect(profileCall).toBeTruthy()
    })
  }, 15000)
})
