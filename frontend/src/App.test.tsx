import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import * as api from './api'

vi.mock('./api', () => ({
  getCurrentUser: vi.fn(),
  getProducts: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('App authentication', () => {
  it('shows the login form when signed out', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null)

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Ledger' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('logs in and displays the authenticated user', async () => {
    const user = userEvent.setup()

    vi.mocked(api.getCurrentUser)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ email: 'owner@example.com' })
    vi.mocked(api.login).mockResolvedValue(undefined)
    vi.mocked(api.getProducts).mockResolvedValue([])

    render(<App />)

    await user.type(
      await screen.findByLabelText('Email'),
      'owner@example.com',
    )
    await user.type(
      screen.getByLabelText('Password'),
      'example-password',
    )
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByText('Signed in as owner@example.com'),
    ).toBeInTheDocument()
    expect(api.login).toHaveBeenCalledWith(
      'owner@example.com',
      'example-password',
    )
  })

  it('displays an error when login fails', async () => {
    const user = userEvent.setup()

    vi.mocked(api.getCurrentUser).mockResolvedValue(null)
    vi.mocked(api.login).mockRejectedValue(
      new Error('Invalid email or password.'),
    )

    render(<App />)

    await user.type(
      await screen.findByLabelText('Email'),
      'owner@example.com',
    )
    await user.type(
      screen.getByLabelText('Password'),
      'wrong-password',
    )
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Invalid email or password.',
      )
    })
  })
})
